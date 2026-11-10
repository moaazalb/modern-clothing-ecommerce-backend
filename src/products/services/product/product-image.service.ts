import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_PRODUCT,
} from '../../constants/product.constants';
import { ImageResponseDto } from '../../dto/image/image-response.dto';
import { ReorderImagesDto } from '../../dto/image/reorder-images.dto';
import { UpdateImageDto } from '../../dto/image/update-image.dto';
import { UploadImageDto } from '../../dto/image/upload-image.dto';
import { ProductColor } from '../../entities/product-color.entity';
import { ProductImage } from '../../entities/product-image.entity';
import { Product } from '../../entities/product.entity';
import { ProductStatus } from '../../enums/product.enum';
import { StorageProvider } from '../../storage/storage.provider';
import { detectImageType } from '../../utils/image-signature.util';
import { lockProductForWrite } from '../../utils/lock-product.util';

/**
 * Product images service (admin operations).
 *
 * Images belong to a group: the general images of the product
 * (colorId = NULL) or the images of one color. The position inside a group
 * is unique (0 is the main image).
 *
 * Every change locks the product row, so two uploads or reorders on the
 * same product never collide. File and database changes cannot share one
 * transaction, so each flow is ordered to fail safely:
 * - upload: file first, then the record (the file is removed if the record fails);
 * - delete: record first, then the file (a failed file removal only leaves a harmless orphan, which is logged).
 */
@Injectable()
export class ProductImageService {
  private readonly logger = new Logger(ProductImageService.name);

  /**
   * Injects the data source and the storage provider.
   *
   * @param dataSource TypeORM data source used to open transactions.
   * @param storage Storage provider that holds the files.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: StorageProvider,
  ) {}

  /**
   * Converts an image entity into the admin response object.
   *
   * @param image Image entity.
   * @returns Admin response data (the URL is built from the storage key).
   */
  private toResponseDto(image: ProductImage): ImageResponseDto {
    return {
      id: image.id,
      productId: image.productId,
      colorId: image.colorId,
      url: this.storage.getPublicUrl(image.storageKey),
      altText: image.altText,
      sortOrder: image.sortOrder,
      createdAt: image.createdAt,
    };
  }

  /**
   * Deletes a stored file without failing the request. A failure leaves an
   * orphan file, which is harmless and is logged for later cleanup.
   *
   * @param storageKey Storage key of the file.
   */
  private async deleteFileQuietly(storageKey: string): Promise<void> {
    try {
      await this.storage.delete(storageKey);
    } catch (error) {
      this.logger.error(
        `Could not delete the file "${storageKey}". It is now an orphan file.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Lists the images of a product: general images first, then each color
   * group, ordered by position.
   *
   * @param productId Product UUID.
   * @returns The images of the product.
   * @throws NotFoundException If the product does not exist.
   */
  async findAll(productId: string): Promise<ImageResponseDto[]> {
    const manager = this.dataSource.manager;

    const productCount = await manager.count(Product, {
      where: { id: productId },
      withDeleted: true,
    });

    if (productCount === 0) {
      throw new NotFoundException(`Product with ID ${productId} was not found.`);
    }

    const images = await manager.find(ProductImage, { where: { productId } });

    images.sort((a, b) => {
      if (a.colorId === b.colorId) return a.sortOrder - b.sortOrder;
      if (a.colorId === null) return -1;
      if (b.colorId === null) return 1;
      return a.colorId.localeCompare(b.colorId);
    });

    return images.map((image) => this.toResponseDto(image));
  }

  /**
   * Uploads an image and adds it at the end of its group.
   *
   * @param productId Product UUID.
   * @param file The uploaded file (multipart field "file").
   * @param dto Optional color and alt text.
   * @returns The created image.
   * @throws BadRequestException If no file was sent.
   * @throws UnsupportedMediaTypeException If the file is not a JPEG, PNG or WebP image.
   * @throws NotFoundException If the product does not exist.
   * @throws ConflictException If the product is deleted.
   * @throws UnprocessableEntityException If the product has too many images, or the color is not linked to the product.
   */
  async upload(
    productId: string,
    file: Express.Multer.File | undefined,
    dto: UploadImageDto,
  ): Promise<ImageResponseDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'An image file is required (multipart field name: "file").',
      );
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('The image is too large.');
    }

    const type = detectImageType(file.buffer);

    if (!type) {
      throw new UnsupportedMediaTypeException(
        'Only JPEG, PNG and WebP images are allowed.',
      );
    }

    const productCount = await this.dataSource.manager.count(Product, {
      where: { id: productId },
      withDeleted: true,
    });

    if (productCount === 0) {
      throw new NotFoundException(`Product with ID ${productId} was not found.`);
    }

    const storageKey = `products/${productId}/${randomUUID()}.${type.extension}`;

    await this.storage.save(storageKey, file.buffer, type.contentType);

    try {
      return await this.dataSource.transaction(async (manager) => {
        await lockProductForWrite(manager, productId);

        const total = await manager.count(ProductImage, {
          where: { productId },
        });

        if (total >= MAX_IMAGES_PER_PRODUCT) {
          throw new UnprocessableEntityException(
            `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images.`,
          );
        }

        const colorId = dto.colorId ?? null;

        if (colorId) {
          const link = await manager.findOne(ProductColor, {
            where: { productId, colorId },
          });

          if (!link) {
            throw new UnprocessableEntityException(
              'The color is not linked to this product.',
            );
          }
        }

        const sortOrder = await this.nextSortOrder(manager, productId, colorId);

        const image = manager.create(ProductImage, {
          productId,
          colorId,
          storageKey,
          altText: dto.altText ? dto.altText : null,
          sortOrder,
        });

        return this.toResponseDto(await manager.save(image));
      });
    } catch (error) {
      await this.deleteFileQuietly(storageKey);
      throw error;
    }
  }

  /**
   * Computes the next free position at the end of an image group.
   *
   * @param manager Entity manager of the running transaction.
   * @param productId Product UUID.
   * @param colorId Color of the group, or null for the general group.
   * @returns The position for a new image.
   */
  private async nextSortOrder(
    manager: EntityManager,
    productId: string,
    colorId: string | null,
  ): Promise<number> {
    const query = manager
      .createQueryBuilder(ProductImage, 'image')
      .select('COALESCE(MAX(image.sortOrder), -1)', 'max')
      .where('image.productId = :productId', { productId });

    if (colorId) {
      query.andWhere('image.colorId = :colorId', { colorId });
    } else {
      query.andWhere('image.colorId IS NULL');
    }

    const row = await query.getRawOne<{ max: number | string }>();

    return Number(row?.max ?? -1) + 1;
  }

  /**
   * Updates the alt text of an image.
   *
   * @param productId Product UUID.
   * @param imageId Image UUID.
   * @param dto New alt text (null or empty clears it).
   * @returns The updated image.
   * @throws NotFoundException If the product or the image does not exist.
   * @throws ConflictException If the product is deleted.
   */
  async updateAltText(
    productId: string,
    imageId: string,
    dto: UpdateImageDto,
  ): Promise<ImageResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      await lockProductForWrite(manager, productId);

      const image = await manager.findOne(ProductImage, {
        where: { id: imageId, productId },
      });

      if (!image) {
        throw new NotFoundException(
          `Image with ID ${imageId} was not found in this product.`,
        );
      }

      if (dto.altText !== undefined) {
        image.altText = dto.altText ? dto.altText : null;
      }

      return this.toResponseDto(await manager.save(image));
    });
  }

  /**
   * Deletes an image: the record first, then the file. The last image of
   * an ACTIVE product cannot be deleted.
   *
   * @param productId Product UUID.
   * @param imageId Image UUID.
   * @throws NotFoundException If the product or the image does not exist.
   * @throws ConflictException If the product is deleted.
   * @throws UnprocessableEntityException If it is the last image of an ACTIVE product.
   */
  async remove(productId: string, imageId: string): Promise<void> {
    const storageKey = await this.dataSource.transaction(async (manager) => {
      const product = await lockProductForWrite(manager, productId);

      const image = await manager.findOne(ProductImage, {
        where: { id: imageId, productId },
      });

      if (!image) {
        throw new NotFoundException(
          `Image with ID ${imageId} was not found in this product.`,
        );
      }

      if (product.status === ProductStatus.ACTIVE) {
        const total = await manager.count(ProductImage, {
          where: { productId },
        });

        if (total <= 1) {
          throw new UnprocessableEntityException(
            'The last image of an ACTIVE product cannot be deleted. Unpublish the product first.',
          );
        }
      }

      await manager.delete(ProductImage, { id: imageId });

      return image.storageKey;
    });

    await this.deleteFileQuietly(storageKey);
  }

  /**
   * Reorders the images of one group. The list must contain exactly the
   * images of the group. Positions become 0..n-1, applied in one
   * transaction with the uniqueness check deferred to the end, so images
   * can swap positions.
   *
   * @param productId Product UUID.
   * @param dto Group (colorId, or null/omitted for general images) and the images in the new order.
   * @returns The images of the group in their new order.
   * @throws NotFoundException If the product does not exist.
   * @throws ConflictException If the product is deleted.
   * @throws UnprocessableEntityException If the list does not match the group exactly.
   */
  async reorder(
    productId: string,
    dto: ReorderImagesDto,
  ): Promise<ImageResponseDto[]> {
    return this.dataSource.transaction(async (manager) => {
      await lockProductForWrite(manager, productId);

      const colorId = dto.colorId ?? null;
      const groupFilter = { productId, colorId: colorId ?? IsNull() };

      const images = await manager.find(ProductImage, { where: groupFilter });
      const groupIds = new Set(images.map((image) => image.id));

      const matches =
        images.length === dto.imageIds.length &&
        dto.imageIds.every((id) => groupIds.has(id));

      if (!matches) {
        throw new UnprocessableEntityException(
          'imageIds must contain exactly the images of the group, no more and no less.',
        );
      }

      await manager.query('SET CONSTRAINTS "uq_images_sort" DEFERRED');

      for (const [position, imageId] of dto.imageIds.entries()) {
        await manager.update(
          ProductImage,
          { id: imageId },
          { sortOrder: position },
        );
      }

      const reordered = await manager.find(ProductImage, {
        where: groupFilter,
        order: { sortOrder: 'ASC' },
      });

      return reordered.map((image) => this.toResponseDto(image));
    });
  }
}
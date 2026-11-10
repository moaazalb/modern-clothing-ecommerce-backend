import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';

import { assertNoNullFields } from '../../../common/utils/assert-no-null-fields.util';
import { CreateVariantDto } from '../../dto/variant/create-variant.dto';
import { UpdateVariantDto } from '../../dto/variant/update-variant.dto';
import { VariantResponseDto } from '../../dto/variant/variant-response.dto';
import { ProductColor } from '../../entities/product-color.entity';
import { ProductSize } from '../../entities/product-size.entity';
import { ProductVariant } from '../../entities/product-variant.entity';
import { Product } from '../../entities/product.entity';
import { ProductStatus } from '../../enums/product.enum';

/**
 * Product variants service (admin operations).
 *
 * A variant is a purchasable Product + Color + Size combination.
 * Every write locks the product row, which serializes variant changes
 * with publishing and with size type changes on the same product.
 *
 * The database cannot enforce that sizeId is NULL if and only if the
 * product has no size type, so this service enforces it.
 *
 * Variants are never deleted: they are disabled with isActive = false,
 * because variants referenced by orders can never be removed.
 */
@Injectable()
export class ProductVariantService {
  /**
   * Injects the repository and the data source used for transactions.
   *
   * @param variantsRepository TypeORM repository for ProductVariant entities.
   * @param dataSource TypeORM data source used to open transactions.
   */
  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Converts a ProductVariant entity into the admin response object.
   *
   * @param variant Variant entity.
   * @param productPrice Base price of the product (used when the variant has no price).
   * @returns Admin response data.
   */
  private toResponseDto(
    variant: ProductVariant,
    productPrice: string,
  ): VariantResponseDto {
    return {
      id: variant.id,
      productId: variant.productId,
      colorId: variant.colorId,
      sizeId: variant.sizeId,
      sku: variant.sku,
      price: variant.price,
      effectivePrice: variant.price ?? productPrice,
      stockQuantity: variant.stockQuantity,
      isActive: variant.isActive,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }

  /**
   * Locks a product row for the rest of the transaction.
   *
   * @param manager Entity manager of the running transaction.
   * @param productId Product UUID.
   * @returns The locked product.
   * @throws NotFoundException If the product does not exist.
   * @throws ConflictException If the product is soft-deleted.
   */
  private async lockProduct(
    manager: EntityManager,
    productId: string,
  ): Promise<Product> {
    const product = await manager.findOne(Product, {
      where: { id: productId },
      withDeleted: true,
      lock: { mode: 'pessimistic_write' },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} was not found.`);
    }

    if (product.deletedAt) {
      throw new ConflictException(
        'The product is deleted. Restore it before changing its variants.',
      );
    }

    return product;
  }

  /**
   * Finds a product for read operations (soft-deleted products are included).
   *
   * @param productId Product UUID.
   * @returns The product.
   * @throws NotFoundException If the product does not exist.
   */
  private async findProductForRead(productId: string): Promise<Product> {
    const product = await this.dataSource.manager.findOne(Product, {
      where: { id: productId },
      withDeleted: true,
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} was not found.`);
    }

    return product;
  }

  /**
   * Creates a variant for a product.
   *
   * @param productId Product UUID.
   * @param dto Validated creation data.
   * @returns The created variant.
   * @throws NotFoundException If the product does not exist.
   * @throws ConflictException If the product is deleted, or the sku/combination already exists.
   * @throws UnprocessableEntityException If the size rule is violated, or the color/size is not linked to the product or is inactive.
   */
  async create(
    productId: string,
    dto: CreateVariantDto,
  ): Promise<VariantResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const product = await this.lockProduct(manager, productId);
      const productNeedsSize = product.sizeType !== null;

      if (productNeedsSize && !dto.sizeId) {
        throw new UnprocessableEntityException(
          'This product uses sizes, so every variant needs a sizeId.',
        );
      }

      if (!productNeedsSize && dto.sizeId) {
        throw new UnprocessableEntityException(
          'This product has no size type, so a variant cannot have a size.',
        );
      }

      const productColor = await manager.findOne(ProductColor, {
        where: { productId, colorId: dto.colorId },
        relations: { color: true },
      });

      if (!productColor) {
        throw new UnprocessableEntityException(
          'The color is not linked to this product.',
        );
      }

      if (!productColor.color.isActive) {
        throw new UnprocessableEntityException('The color is inactive.');
      }

      if (dto.sizeId) {
        const productSize = await manager.findOne(ProductSize, {
          where: { productId, sizeId: dto.sizeId },
          relations: { size: true },
        });

        if (!productSize) {
          throw new UnprocessableEntityException(
            'The size is not linked to this product.',
          );
        }

        if (!productSize.size.isActive) {
          throw new UnprocessableEntityException('The size is inactive.');
        }
      }

      const variant = manager.create(ProductVariant, {
        productId,
        colorId: dto.colorId,
        sizeId: dto.sizeId ?? null,
        sku: dto.sku,
        price: dto.price ?? null,
        stockQuantity: dto.stockQuantity ?? 0,
        isActive: dto.isActive ?? true,
      });

      const saved = await manager.save(variant);

      return this.toResponseDto(saved, product.price);
    });
  }

  /**
   * Lists the variants of a product, ordered by sku.
   *
   * @param productId Product UUID.
   * @returns The variants of the product.
   * @throws NotFoundException If the product does not exist.
   */
  async findAll(productId: string): Promise<VariantResponseDto[]> {
    const product = await this.findProductForRead(productId);

    const variants = await this.variantsRepository.find({
      where: { productId },
      order: { sku: 'ASC' },
    });

    return variants.map((variant) => this.toResponseDto(variant, product.price));
  }

  /**
   * Retrieves one variant of a product.
   *
   * @param productId Product UUID.
   * @param variantId Variant UUID.
   * @returns The variant.
   * @throws NotFoundException If the product or the variant does not exist.
   */
  async findOne(
    productId: string,
    variantId: string,
  ): Promise<VariantResponseDto> {
    const product = await this.findProductForRead(productId);

    const variant = await this.variantsRepository.findOne({
      where: { id: variantId, productId },
    });

    if (!variant) {
      throw new NotFoundException(
        `Variant with ID ${variantId} was not found in this product.`,
      );
    }

    return this.toResponseDto(variant, product.price);
  }

  /**
   * Updates the sku, price override or active flag of a variant.
   *
   * Null is accepted only for price (it means "use the product price").
   * Only the changed columns are written, so a concurrent stock update is
   * never overwritten. The last active variant of an ACTIVE product cannot
   * be deactivated.
   *
   * @param productId Product UUID.
   * @param variantId Variant UUID.
   * @param dto Fields to update.
   * @returns The updated variant.
   * @throws BadRequestException If a non-nullable field is null.
   * @throws NotFoundException If the product or the variant does not exist.
   * @throws ConflictException If the product is deleted, or the sku already exists.
   * @throws UnprocessableEntityException If the last active variant of an ACTIVE product would be deactivated.
   */
  async update(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
  ): Promise<VariantResponseDto> {
    assertNoNullFields(dto, ['price']);

    return this.dataSource.transaction(async (manager) => {
      const product = await this.lockProduct(manager, productId);

      const variant = await manager.findOne(ProductVariant, {
        where: { id: variantId, productId },
      });

      if (!variant) {
        throw new NotFoundException(
          `Variant with ID ${variantId} was not found in this product.`,
        );
      }

      if (
        dto.isActive === false &&
        variant.isActive &&
        product.status === ProductStatus.ACTIVE
      ) {
        const otherActive = await manager.count(ProductVariant, {
          where: { productId, isActive: true, id: Not(variantId) },
        });

        if (otherActive === 0) {
          throw new UnprocessableEntityException(
            'The last active variant of an ACTIVE product cannot be deactivated. Unpublish the product first.',
          );
        }
      }

      if (dto.sku !== undefined) variant.sku = dto.sku;
      if (dto.price !== undefined) variant.price = dto.price;
      if (dto.isActive !== undefined) variant.isActive = dto.isActive;

      const saved = await manager.save(variant);

      return this.toResponseDto(saved, product.price);
    });
  }
}
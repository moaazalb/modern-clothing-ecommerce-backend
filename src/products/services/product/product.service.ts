import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';

import { assertNoNullFields } from '../../../common/utils/assert-no-null-fields.util';
import {
  compareMoney,
  fromCents,
  toCents,
} from '../../../common/utils/money.util';
import { slugify } from '../../../common/utils/slug.util';
import { AddProductColorDto } from '../../dto/product/add-product-color.dto';
import { AddProductSizeDto } from '../../dto/product/add-product-size.dto';
import { CreateProductDto } from '../../dto/product/create-product.dto';
import { ProductResponseDto } from '../../dto/product/product-response.dto';
import { PublishViolationDto } from '../../dto/product/publish-violation.dto';
import { SetProductTagsDto } from '../../dto/product/set-product-tags.dto';
import { UpdateProductDto } from '../../dto/product/update-product.dto';
import { Brand } from '../../entities/brand.entity';
import { Color } from '../../entities/color.entity';
import { ProductColor } from '../../entities/product-color.entity';
import { ProductImage } from '../../entities/product-image.entity';
import { ProductSize } from '../../entities/product-size.entity';
import { ProductTag } from '../../entities/product-tag.entity';
import { ProductVariant } from '../../entities/product-variant.entity';
import { Product } from '../../entities/product.entity';
import { Size } from '../../entities/size.entity';
import { Tag } from '../../entities/tag.entity';
import { ProductStatus, PublishViolationCode } from '../../enums/product.enum';
import { CategoryVisibilityService } from '../category/category-visibility.service';

/**
 * Maximum length of a product slug (matches the column length).
 */
const SLUG_MAX_LENGTH = 220;

/**
 * Maximum number of numeric suffixes tried for an auto-generated slug.
 */
const SLUG_MAX_ATTEMPTS = 50;

/**
 * Product fields that accept null in an update (they clear the value).
 */
const NULLABLE_UPDATE_FIELDS = [
  'description',
  'shortDescription',
  'brandId',
  'sizeType',
  'metaTitle',
  'metaDescription',
] as const;

/**
 * Converts an empty or missing text to null.
 *
 * @param value Text value.
 * @returns The text, or null when it is empty or missing.
 */
function emptyToNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

/**
 * Products service (admin write operations).
 *
 * Every write locks the product row, so publishing, variant changes and
 * size type changes on the same product are serialized. A soft-deleted
 * product rejects every change except being restored.
 */
@Injectable()
export class ProductService {
  /**
   * Injects the data source and the category visibility service.
   *
   * @param dataSource TypeORM data source used to open transactions.
   * @param categoryVisibility Checks whether a category is effectively active.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly categoryVisibility: CategoryVisibilityService,
  ) {}

  /**
   * Converts a Product entity into the admin response object.
   *
   * @param product Product entity.
   * @returns Admin response data.
   */
  private toResponseDto(product: Product): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDescription: product.shortDescription,
      price: product.price,
      categoryId: product.categoryId,
      brandId: product.brandId,
      gender: product.gender,
      sizeType: product.sizeType,
      status: product.status,
      isFeatured: product.isFeatured,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      deletedAt: product.deletedAt,
    };
  }

  /**
   * Locks a product row for the rest of the transaction.
   *
   * @param manager Entity manager of the running transaction.
   * @param productId Product UUID.
   * @param allowDeleted True only for the restore operation.
   * @returns The locked product.
   * @throws NotFoundException If the product does not exist.
   * @throws ConflictException If the product is soft-deleted and deleted products are not allowed.
   */
  private async lockProduct(
    manager: EntityManager,
    productId: string,
    allowDeleted = false,
  ): Promise<Product> {
    const product = await manager.findOne(Product, {
      where: { id: productId },
      withDeleted: true,
      lock: { mode: 'pessimistic_write' },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} was not found.`);
    }

    if (product.deletedAt && !allowDeleted) {
      throw new ConflictException(
        'The product is deleted. Restore it before changing it.',
      );
    }

    return product;
  }

  /**
   * Ensures a category exists and is effectively active.
   *
   * @param manager Entity manager of the running transaction.
   * @param categoryId Category UUID.
   * @throws UnprocessableEntityException If the category is missing or inactive.
   */
  private async assertCategoryUsable(
    manager: EntityManager,
    categoryId: string,
  ): Promise<void> {
    const active = await this.categoryVisibility.isEffectivelyActive(
      categoryId,
      manager,
    );

    if (active === null) {
      throw new UnprocessableEntityException('The category was not found.');
    }

    if (!active) {
      throw new UnprocessableEntityException(
        'The category (or one of its parent categories) is inactive.',
      );
    }
  }

  /**
   * Ensures a brand exists and is active.
   *
   * @param manager Entity manager of the running transaction.
   * @param brandId Brand UUID.
   * @throws UnprocessableEntityException If the brand is missing or inactive.
   */
  private async assertBrandUsable(
    manager: EntityManager,
    brandId: string,
  ): Promise<void> {
    const brand = await manager.findOne(Brand, { where: { id: brandId } });

    if (!brand) {
      throw new UnprocessableEntityException('The brand was not found.');
    }

    if (!brand.isActive) {
      throw new UnprocessableEntityException('The brand is inactive.');
    }
  }

  /**
   * Checks whether a slug is used by any product, including deleted ones.
   *
   * @param manager Entity manager of the running transaction.
   * @param slug Slug to check.
   * @param excludeId Product that is allowed to keep the slug.
   * @returns True if another product uses the slug.
   */
  private async isSlugTaken(
    manager: EntityManager,
    slug: string,
    excludeId?: string,
  ): Promise<boolean> {
    const existing = await manager.findOne(Product, {
      where: { slug },
      withDeleted: true,
      select: { id: true },
    });

    return !!existing && existing.id !== excludeId;
  }

  /**
   * Ensures an explicitly provided slug is free.
   *
   * @param manager Entity manager of the running transaction.
   * @param slug Slug to check.
   * @param excludeId Product that is allowed to keep the slug.
   * @throws ConflictException If another product uses the slug.
   */
  private async assertSlugAvailable(
    manager: EntityManager,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    if (await this.isSlugTaken(manager, slug, excludeId)) {
      throw new ConflictException(
        `A product with the slug "${slug}" already exists.`,
      );
    }
  }

  /**
   * Finds a free slug by adding -2, -3... to a generated base slug.
   *
   * @param manager Entity manager of the running transaction.
   * @param baseSlug Slug generated from the product name.
   * @returns A slug that no product uses.
   * @throws ConflictException If no free slug was found.
   */
  private async generateUniqueSlug(
    manager: EntityManager,
    baseSlug: string,
  ): Promise<string> {
    if (!(await this.isSlugTaken(manager, baseSlug))) {
      return baseSlug;
    }

    for (let attempt = 2; attempt <= SLUG_MAX_ATTEMPTS; attempt += 1) {
      const suffix = `-${attempt}`;
      const candidate = `${baseSlug.slice(0, SLUG_MAX_LENGTH - suffix.length)}${suffix}`;

      if (!(await this.isSlugTaken(manager, candidate))) {
        return candidate;
      }
    }

    throw new ConflictException(
      'Too many products share this name. Please provide a slug.',
    );
  }

  /**
   * Creates a product as DRAFT.
   *
   * @param dto Validated creation data.
   * @returns The created product.
   * @throws UnprocessableEntityException If no slug can be generated, or the category/brand is missing or inactive.
   * @throws ConflictException If an explicit slug is already used.
   */
  async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    const baseSlug = dto.slug ?? slugify(dto.name, SLUG_MAX_LENGTH);

    if (!baseSlug) {
      throw new UnprocessableEntityException(
        'A slug could not be generated from the name. Please provide a slug.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      await this.assertCategoryUsable(manager, dto.categoryId);

      if (dto.brandId) {
        await this.assertBrandUsable(manager, dto.brandId);
      }

      let slug = baseSlug;

      if (dto.slug) {
        await this.assertSlugAvailable(manager, dto.slug);
      } else {
        slug = await this.generateUniqueSlug(manager, baseSlug);
      }

      const product = manager.create(Product, {
        name: dto.name,
        slug,
        description: emptyToNull(dto.description),
        shortDescription: emptyToNull(dto.shortDescription),
        price: fromCents(toCents(dto.price)),
        categoryId: dto.categoryId,
        brandId: dto.brandId ?? null,
        gender: dto.gender,
        sizeType: dto.sizeType ?? null,
        status: ProductStatus.DRAFT,
        isFeatured: dto.isFeatured ?? false,
        metaTitle: emptyToNull(dto.metaTitle),
        metaDescription: emptyToNull(dto.metaDescription),
      });

      return this.toResponseDto(await manager.save(product));
    });
  }

  /**
   * Rejects a size type change while the product has sizes or variants.
   *
   * @param manager Entity manager of the running transaction.
   * @param productId Product UUID.
   * @throws ConflictException If sizes or variants exist.
   */
  private async assertSizeTypeChangeAllowed(
    manager: EntityManager,
    productId: string,
  ): Promise<void> {
    const sizes = await manager.count(ProductSize, { where: { productId } });
    const variants = await manager.count(ProductVariant, {
      where: { productId },
    });

    if (sizes > 0 || variants > 0) {
      throw new ConflictException(
        'The size type cannot be changed while the product has sizes or variants.',
      );
    }
  }

  /**
   * Updates a product.
   *
   * Null is accepted only for description, shortDescription, brandId,
   * sizeType, metaTitle and metaDescription. The slug can change only
   * while the product is DRAFT. An ACTIVE product cannot get a price of 0.
   *
   * @param id Product UUID.
   * @param dto Fields to update.
   * @returns The updated product.
   * @throws BadRequestException If a non-nullable field is null.
   * @throws NotFoundException If the product does not exist.
   * @throws ConflictException If the product is deleted, the slug is taken or locked, or the size type cannot change.
   * @throws UnprocessableEntityException If the category/brand is invalid, or an ACTIVE product would get a price of 0.
   */
  async update(
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    assertNoNullFields(dto, NULLABLE_UPDATE_FIELDS);

    return this.dataSource.transaction(async (manager) => {
      const product = await this.lockProduct(manager, id);

      if (dto.slug !== undefined && dto.slug !== product.slug) {
        if (product.status !== ProductStatus.DRAFT) {
          throw new ConflictException(
            'The slug can be changed only while the product is DRAFT.',
          );
        }

        await this.assertSlugAvailable(manager, dto.slug, id);
        product.slug = dto.slug;
      }

      if (dto.categoryId !== undefined && dto.categoryId !== product.categoryId) {
        await this.assertCategoryUsable(manager, dto.categoryId);
        product.categoryId = dto.categoryId;
      }

      if (dto.brandId !== undefined && dto.brandId !== product.brandId) {
        if (dto.brandId !== null) {
          await this.assertBrandUsable(manager, dto.brandId);
        }

        product.brandId = dto.brandId;
      }

      if (dto.sizeType !== undefined && dto.sizeType !== product.sizeType) {
        await this.assertSizeTypeChangeAllowed(manager, id);
        product.sizeType = dto.sizeType;
      }

      if (dto.price !== undefined) {
        const price = fromCents(toCents(dto.price));

        if (
          product.status === ProductStatus.ACTIVE &&
          compareMoney(price, '0') <= 0
        ) {
          throw new UnprocessableEntityException(
            'An ACTIVE product needs a price greater than 0.',
          );
        }

        product.price = price;
      }

      if (dto.name !== undefined) product.name = dto.name;
      if (dto.gender !== undefined) product.gender = dto.gender;
      if (dto.isFeatured !== undefined) product.isFeatured = dto.isFeatured;

      if (dto.description !== undefined) {
        product.description = emptyToNull(dto.description);
      }

      if (dto.shortDescription !== undefined) {
        product.shortDescription = emptyToNull(dto.shortDescription);
      }

      if (dto.metaTitle !== undefined) {
        product.metaTitle = emptyToNull(dto.metaTitle);
      }

      if (dto.metaDescription !== undefined) {
        product.metaDescription = emptyToNull(dto.metaDescription);
      }

      return this.toResponseDto(await manager.save(product));
    });
  }

  /**
   * Soft-deletes a product. Variants, stock, images and relations are kept.
   *
   * @param id Product UUID.
   * @throws NotFoundException If the product does not exist.
   * @throws ConflictException If the product is already deleted.
   */
  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockProduct(manager, id);
      await manager.softDelete(Product, id);
    });
  }

  /**
   * Restores a soft-deleted product. It always comes back as DRAFT, so the
   * publishing rules are checked again before it is visible.
   *
   * @param id Product UUID.
   * @returns The restored product.
   * @throws NotFoundException If the product does not exist.
   * @throws ConflictException If the product is not deleted.
   */
  async restore(id: string): Promise<ProductResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const product = await this.lockProduct(manager, id, true);

      if (!product.deletedAt) {
        throw new ConflictException('The product is not deleted.');
      }

      await manager.update(
        Product,
        { id },
        { deletedAt: null, status: ProductStatus.DRAFT },
      );

      const restored = await manager.findOneOrFail(Product, {
        where: { id },
      });

      return this.toResponseDto(restored);
    });
  }

  /**
   * Collects every reason why a product cannot be published.
   *
   * @param manager Entity manager of the running transaction.
   * @param product The locked product.
   * @returns The violations (empty when the product can be published).
   */
  private async findPublishViolations(
    manager: EntityManager,
    product: Product,
  ): Promise<PublishViolationDto[]> {
    const violations: PublishViolationDto[] = [];
    const productId = product.id;

    if (compareMoney(product.price, '0') <= 0) {
      violations.push({
        code: PublishViolationCode.PRICE_NOT_POSITIVE,
        message: 'The price must be greater than 0.',
      });
    }

    const categoryActive = await this.categoryVisibility.isEffectivelyActive(
      product.categoryId,
      manager,
    );

    if (categoryActive !== true) {
      violations.push({
        code: PublishViolationCode.CATEGORY_INACTIVE,
        message: 'The category (or one of its parent categories) is inactive.',
      });
    }

    if (product.brandId) {
      const brand = await manager.findOne(Brand, {
        where: { id: product.brandId },
      });

      if (!brand?.isActive) {
        violations.push({
          code: PublishViolationCode.BRAND_INACTIVE,
          message: 'The brand is inactive.',
        });
      }
    }

    const colors = await manager.count(ProductColor, { where: { productId } });

    if (colors === 0) {
      violations.push({
        code: PublishViolationCode.NO_COLORS,
        message: 'The product has no colors.',
      });
    }

    if (product.sizeType !== null) {
      const sizes = await manager.count(ProductSize, { where: { productId } });

      if (sizes === 0) {
        violations.push({
          code: PublishViolationCode.NO_SIZES,
          message: 'The product uses sizes but none is linked.',
        });
      }

      const sizelessVariants = await manager.count(ProductVariant, {
        where: { productId, sizeId: IsNull() },
      });

      if (sizelessVariants > 0) {
        violations.push({
          code: PublishViolationCode.VARIANT_MISSING_SIZE,
          message:
            'Some variants have no size although the product uses sizes.',
        });
      }
    }

    const purchasableVariants = await manager
      .createQueryBuilder(ProductVariant, 'variant')
      .innerJoin(Color, 'color', 'color.id = variant.colorId')
      .leftJoin(Size, 'size', 'size.id = variant.sizeId')
      .where('variant.productId = :productId', { productId })
      .andWhere('variant.isActive = true')
      .andWhere('color.isActive = true')
      .andWhere('(variant.sizeId IS NULL OR size.isActive = true)')
      .getCount();

    if (purchasableVariants === 0) {
      violations.push({
        code: PublishViolationCode.NO_ACTIVE_VARIANT,
        message:
          'The product has no purchasable variant (an active variant with an active color and size).',
      });
    }

    const images = await manager.count(ProductImage, { where: { productId } });

    if (images === 0) {
      violations.push({
        code: PublishViolationCode.NO_IMAGES,
        message: 'The product has no images.',
      });
    }

    return violations;
  }

  /**
   * Moves a product to a target status. Moving to the same status changes
   * nothing. Only the move to ACTIVE is validated.
   *
   * @param id Product UUID.
   * @param target Target status.
   * @returns The product after the change.
   * @throws NotFoundException If the product does not exist.
   * @throws ConflictException If the product is deleted.
   * @throws UnprocessableEntityException If the product cannot be published (body includes every violation).
   */
  private async changeStatus(
    id: string,
    target: ProductStatus,
  ): Promise<ProductResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const product = await this.lockProduct(manager, id);

      if (product.status === target) {
        return this.toResponseDto(product);
      }

      if (target === ProductStatus.ACTIVE) {
        const violations = await this.findPublishViolations(manager, product);

        if (violations.length > 0) {
          throw new UnprocessableEntityException({
            statusCode: 422,
            error: 'Unprocessable Entity',
            code: 'PRODUCT_NOT_PUBLISHABLE',
            message: 'The product cannot be published.',
            violations,
          });
        }
      }

      product.status = target;

      return this.toResponseDto(await manager.save(product));
    });
  }

  /**
   * Publishes a product (DRAFT or ARCHIVED to ACTIVE) after checking the
   * publishing rules.
   *
   * @param id Product UUID.
   * @returns The published product.
   */
  publish(id: string): Promise<ProductResponseDto> {
    return this.changeStatus(id, ProductStatus.ACTIVE);
  }

  /**
   * Returns a product to DRAFT (hidden from customers).
   *
   * @param id Product UUID.
   * @returns The product as DRAFT.
   */
  unpublish(id: string): Promise<ProductResponseDto> {
    return this.changeStatus(id, ProductStatus.DRAFT);
  }

  /**
   * Archives a product (hidden and not purchasable, kept for history).
   *
   * @param id Product UUID.
   * @returns The archived product.
   */
  archive(id: string): Promise<ProductResponseDto> {
    return this.changeStatus(id, ProductStatus.ARCHIVED);
  }

  /**
   * Links an active color to a product.
   *
   * @param productId Product UUID.
   * @param dto The color to link.
   * @throws NotFoundException If the product does not exist.
   * @throws ConflictException If the product is deleted or the color is already linked.
   * @throws UnprocessableEntityException If the color is missing or inactive.
   */
  async addColor(productId: string, dto: AddProductColorDto): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockProduct(manager, productId);

      const color = await manager.findOne(Color, {
        where: { id: dto.colorId },
      });

      if (!color) {
        throw new UnprocessableEntityException('The color was not found.');
      }

      if (!color.isActive) {
        throw new UnprocessableEntityException('The color is inactive.');
      }

      const existing = await manager.findOne(ProductColor, {
        where: { productId, colorId: dto.colorId },
      });

      if (existing) {
        throw new ConflictException(
          'The color is already linked to this product.',
        );
      }

      await manager.insert(ProductColor, { productId, colorId: dto.colorId });
    });
  }

  /**
   * Unlinks a color from a product. Rejected while a variant or an image
   * of the product uses the color.
   *
   * @param productId Product UUID.
   * @param colorId Color UUID.
   * @throws NotFoundException If the product or the link does not exist.
   * @throws ConflictException If the product is deleted or the color is in use.
   */
  async removeColor(productId: string, colorId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockProduct(manager, productId);

      const link = await manager.findOne(ProductColor, {
        where: { productId, colorId },
      });

      if (!link) {
        throw new NotFoundException(
          'The color is not linked to this product.',
        );
      }

      const variants = await manager.count(ProductVariant, {
        where: { productId, colorId },
      });

      if (variants > 0) {
        throw new ConflictException(
          'The color is used by variants of this product. Disable those variants instead.',
        );
      }

      const images = await manager.count(ProductImage, {
        where: { productId, colorId },
      });

      if (images > 0) {
        throw new ConflictException(
          'The color is used by images of this product. Delete those images first.',
        );
      }

      await manager.delete(ProductColor, { productId, colorId });
    });
  }

  /**
   * Links an active size to a product. The size must belong to the
   * product's size system.
   *
   * @param productId Product UUID.
   * @param dto The size to link.
   * @throws NotFoundException If the product does not exist.
   * @throws ConflictException If the product is deleted or the size is already linked.
   * @throws UnprocessableEntityException If the product has no size type, or the size is missing, inactive or from another size system.
   */
  async addSize(productId: string, dto: AddProductSizeDto): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const product = await this.lockProduct(manager, productId);

      if (product.sizeType === null) {
        throw new UnprocessableEntityException(
          'This product has no size type, so sizes cannot be linked.',
        );
      }

      const size = await manager.findOne(Size, { where: { id: dto.sizeId } });

      if (!size) {
        throw new UnprocessableEntityException('The size was not found.');
      }

      if (!size.isActive) {
        throw new UnprocessableEntityException('The size is inactive.');
      }

      if (size.sizeType !== product.sizeType) {
        throw new UnprocessableEntityException(
          `The size belongs to the ${size.sizeType} system but the product uses ${product.sizeType}.`,
        );
      }

      const existing = await manager.findOne(ProductSize, {
        where: { productId, sizeId: dto.sizeId },
      });

      if (existing) {
        throw new ConflictException(
          'The size is already linked to this product.',
        );
      }

      await manager.insert(ProductSize, {
        productId,
        sizeId: dto.sizeId,
        sizeType: size.sizeType,
      });
    });
  }

  /**
   * Unlinks a size from a product. Rejected while a variant uses the size.
   *
   * @param productId Product UUID.
   * @param sizeId Size UUID.
   * @throws NotFoundException If the product or the link does not exist.
   * @throws ConflictException If the product is deleted or the size is in use.
   */
  async removeSize(productId: string, sizeId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockProduct(manager, productId);

      const link = await manager.findOne(ProductSize, {
        where: { productId, sizeId },
      });

      if (!link) {
        throw new NotFoundException('The size is not linked to this product.');
      }

      const variants = await manager.count(ProductVariant, {
        where: { productId, sizeId },
      });

      if (variants > 0) {
        throw new ConflictException(
          'The size is used by variants of this product. Disable those variants instead.',
        );
      }

      await manager.delete(ProductSize, { productId, sizeId });
    });
  }

  /**
   * Replaces the whole set of tags of a product. Tags that are already
   * linked stay linked even if they became inactive; new links must be
   * active tags.
   *
   * @param productId Product UUID.
   * @param dto The complete list of tag identifiers.
   * @throws NotFoundException If the product does not exist.
   * @throws ConflictException If the product is deleted.
   * @throws UnprocessableEntityException If a new tag is missing or inactive.
   */
  async setTags(productId: string, dto: SetProductTagsDto): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockProduct(manager, productId);

      const current = await manager.find(ProductTag, { where: { productId } });
      const currentIds = new Set(current.map((link) => link.tagId));
      const wantedIds = new Set(dto.tagIds);

      const toAdd = dto.tagIds.filter((tagId) => !currentIds.has(tagId));
      const toRemove = current
        .filter((link) => !wantedIds.has(link.tagId))
        .map((link) => link.tagId);

      if (toAdd.length > 0) {
        const tags = await manager.find(Tag, { where: { id: In(toAdd) } });
        const foundIds = new Set(tags.map((tag) => tag.id));
        const missing = toAdd.filter((tagId) => !foundIds.has(tagId));

        if (missing.length > 0) {
          throw new UnprocessableEntityException(
            `These tags were not found: ${missing.join(', ')}.`,
          );
        }

        const inactive = tags.filter((tag) => !tag.isActive);

        if (inactive.length > 0) {
          throw new UnprocessableEntityException(
            `These tags are inactive: ${inactive.map((tag) => tag.name).join(', ')}.`,
          );
        }

        await manager.insert(
          ProductTag,
          toAdd.map((tagId) => ({ productId, tagId })),
        );
      }

      if (toRemove.length > 0) {
        await manager.delete(ProductTag, { productId, tagId: In(toRemove) });
      }
    });
  }
}
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';

import {
  buildPaginated,
  PaginatedResponseDto,
} from '../../../common/dto/paginated-response.dto';
import { fromCents, toCents } from '../../../common/utils/money.util';
import { SLUG_REGEX } from '../../constants/product.constants';
import { PublicBrandDto } from '../../dto/catalog/brand/public-brand.dto';
import { PublicCategoryDto } from '../../dto/catalog/category/public-category.dto';
import { PublicColorDto } from '../../dto/catalog/color/public-color.dto';
import { PublicSizeDto } from '../../dto/catalog/size/public-size.dto';
import { PublicTagDto } from '../../dto/catalog/tag/public-tag.dto';
import { PublicImageDto } from '../../dto/image/public-image.dto';
import { ProductListQueryDto } from '../../dto/product/product-list-query.dto';
import { PublicProductDetailDto } from '../../dto/product/public-product-detail.dto';
import { PublicProductListItemDto } from '../../dto/product/public-product-list-item.dto';
import { PublicVariantDto } from '../../dto/variant/public-variant.dto';
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
import { ProductStatus } from '../../enums/product.enum';
import { StorageProvider } from '../../storage/storage.provider';
import { CategoryVisibilityService } from './../category/category-visibility.service';
import { ProductSearchService } from './../product/product-search.service';

/**
 * Price and stock summary of the buyable variants of one product.
 */
interface PriceSummary {
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
}

/**
 * Normalizes a money value returned by PostgreSQL to two decimals.
 *
 * @param value Money string such as "55" or "55.00".
 * @returns Money string with two decimals.
 */
function normalizeMoney(value: string): string {
  return fromCents(toCents(value));
}

/**
 * Converts a Color entity into the public color object.
 *
 * @param color Color entity.
 * @returns Public color data.
 */
function toPublicColor(color: Color): PublicColorDto {
  return {
    id: color.id,
    name: color.name,
    slug: color.slug,
    hexCode: color.hexCode,
  };
}

/**
 * Converts a Size entity into the public size object.
 *
 * @param size Size entity.
 * @returns Public size data.
 */
function toPublicSize(size: Size): PublicSizeDto {
  return {
    id: size.id,
    name: size.name,
    code: size.code,
    sizeType: size.sizeType,
    sortOrder: size.sortOrder,
  };
}

/**
 * Converts a Tag entity into the public tag object.
 *
 * @param tag Tag entity.
 * @returns Public tag data.
 */
function toPublicTag(tag: Tag): PublicTagDto {
  return { id: tag.id, name: tag.name, slug: tag.slug };
}

/**
 * Converts a Brand entity into the public brand object.
 *
 * @param brand Brand entity.
 * @returns Public brand data.
 */
function toPublicBrand(brand: Brand): PublicBrandDto {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoUrl,
  };
}

/**
 * Public (storefront) product operations: the listing and the product page.
 *
 * The listing takes its filters, sorting and visibility rules from the
 * shared ProductSearchService. The product page applies the same rules for
 * a single product: ACTIVE, not deleted, effectively active category and
 * active brand. Anything that is not visible answers 404, never 403, so
 * hidden products cannot be discovered.
 *
 * Nothing internal is exposed: no status, no deletedAt, no isActive flags
 * and no exact stock quantity (only inStock).
 */
@Injectable()
export class PublicProductService {
  /**
   * Injects the services this class relies on.
   *
   * @param dataSource TypeORM data source.
   * @param searchService Shared product search engine.
   * @param categoryVisibility Checks whether a category is effectively active.
   * @param storage Storage provider used to build image URLs.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly searchService: ProductSearchService,
    private readonly categoryVisibility: CategoryVisibilityService,
    private readonly storage: StorageProvider,
  ) {}

  /**
   * Builds the public image object, including its public URL.
   *
   * @param image Image entity.
   * @returns Public image data.
   */
  private toPublicImage(image: ProductImage): PublicImageDto {
    return {
      id: image.id,
      url: this.storage.getPublicUrl(image.storageKey),
      altText: image.altText,
      colorId: image.colorId,
      sortOrder: image.sortOrder,
    };
  }

  /**
   * Loads the lowest and highest effective price, and the stock state, of
   * the buyable variants of several products at once.
   *
   * A variant is buyable when it is active, its color is active, and its
   * size is absent or active. Products without buyable variants are not in
   * the result.
   *
   * @param productIds Product UUIDs.
   * @returns Summaries by product id.
   */
  private async loadPriceSummaries(
    productIds: string[],
  ): Promise<Map<string, PriceSummary>> {
    const rows: {
      productId: string;
      minPrice: string;
      maxPrice: string;
      inStock: boolean;
    }[] = await this.dataSource.query(
      `SELECT v."productId" AS "productId",
              MIN(COALESCE(v."price", p."price")) AS "minPrice",
              MAX(COALESCE(v."price", p."price")) AS "maxPrice",
              BOOL_OR(v."stockQuantity" > 0) AS "inStock"
       FROM "product_variants" v
       JOIN "products" p ON p."id" = v."productId"
       JOIN "colors" vc ON vc."id" = v."colorId"
       LEFT JOIN "sizes" vs ON vs."id" = v."sizeId"
       WHERE v."productId" = ANY($1::uuid[])
         AND v."isActive" = true
         AND vc."isActive" = true
         AND (v."sizeId" IS NULL OR vs."isActive" = true)
       GROUP BY v."productId"`,
      [productIds],
    );

    return new Map(
      rows.map((row) => [
        row.productId,
        {
          minPrice: normalizeMoney(row.minPrice),
          maxPrice: normalizeMoney(row.maxPrice),
          inStock: row.inStock,
        },
      ]),
    );
  }

  /**
   * Picks the main image of a product: the general image at position 0, or
   * else the position-0 image of the first active color that has one.
   *
   * @param images Position-0 images of the product.
   * @param colors Active colors of the product, in display order.
   * @returns The main image, or null when the product has none.
   */
  private pickMainImage(
    images: ProductImage[],
    colors: PublicColorDto[],
  ): PublicImageDto | null {
    const general = images.find((image) => image.colorId === null);

    if (general) {
      return this.toPublicImage(general);
    }

    for (const color of colors) {
      const colored = images.find((image) => image.colorId === color.id);

      if (colored) {
        return this.toPublicImage(colored);
      }
    }

    return null;
  }

  /**
   * Lists the products visible to customers, with filters, sorting and
   * pagination.
   *
   * @param query Validated list query.
   * @returns A page of product cards.
   * @throws UnprocessableEntityException If minPrice is greater than maxPrice.
   */
  async findAll(
    query: ProductListQueryDto,
  ): Promise<PaginatedResponseDto<PublicProductListItemDto>> {
    const { ids, total } = await this.searchService.searchIds(query, 'public');

    if (ids.length === 0) {
      return buildPaginated([], total, query.page, query.limit);
    }

    const manager = this.dataSource.manager;

    const [products, summaries, colorLinks, images] = await Promise.all([
      manager.find(Product, {
        where: { id: In(ids) },
        relations: { brand: true },
      }),
      this.loadPriceSummaries(ids),
      manager
        .createQueryBuilder(ProductColor, 'link')
        .innerJoinAndSelect('link.color', 'color')
        .where('link.productId IN (:...ids)', { ids })
        .andWhere('color.isActive = true')
        .orderBy('color.name', 'ASC')
        .addOrderBy('color.id', 'ASC')
        .getMany(),
      manager.find(ProductImage, {
        where: { productId: In(ids), sortOrder: 0 },
      }),
    ]);

    const productById = new Map(
      products.map((product) => [product.id, product]),
    );

    const colorsByProduct = new Map<string, PublicColorDto[]>();

    for (const link of colorLinks) {
      const list = colorsByProduct.get(link.productId) ?? [];
      list.push(toPublicColor(link.color));
      colorsByProduct.set(link.productId, list);
    }

    const imagesByProduct = new Map<string, ProductImage[]>();

    for (const image of images) {
      const list = imagesByProduct.get(image.productId) ?? [];
      list.push(image);
      imagesByProduct.set(image.productId, list);
    }

    const items: PublicProductListItemDto[] = [];

    for (const id of ids) {
      const product = productById.get(id);

      if (!product) {
        continue;
      }

      const colors = colorsByProduct.get(id) ?? [];
      const summary = summaries.get(id);

      items.push({
        id: product.id,
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription,
        gender: product.gender,
        isFeatured: product.isFeatured,
        minPrice: summary?.minPrice ?? product.price,
        maxPrice: summary?.maxPrice ?? product.price,
        inStock: summary?.inStock ?? false,
        brand: product.brand ? toPublicBrand(product.brand) : null,
        mainImage: this.pickMainImage(imagesByProduct.get(id) ?? [], colors),
        colors,
      });
    }

    return buildPaginated(items, total, query.page, query.limit);
  }

  /**
   * Retrieves the public page of one product by its slug.
   *
   * @param slug Product slug.
   * @returns The product with its enabled colors, sizes, tags, images and variants.
   * @throws NotFoundException If the product does not exist or is not visible to customers.
   */
  async findBySlug(slug: string): Promise<PublicProductDetailDto> {
    const normalizedSlug = slug.trim().toLowerCase();

    if (!SLUG_REGEX.test(normalizedSlug)) {
      throw new NotFoundException('Product not found.');
    }

    const manager = this.dataSource.manager;

    const product = await manager.findOne(Product, {
      where: { slug: normalizedSlug, status: ProductStatus.ACTIVE },
      relations: { category: true, brand: true },
    });

    if (!product || (product.brand && !product.brand.isActive)) {
      throw new NotFoundException('Product not found.');
    }

    const categoryActive = await this.categoryVisibility.isEffectivelyActive(
      product.categoryId,
    );

    if (categoryActive !== true) {
      throw new NotFoundException('Product not found.');
    }

    const [colorLinks, sizeLinks, tagLinks, variants, images] =
      await Promise.all([
        manager.find(ProductColor, {
          where: { productId: product.id },
          relations: { color: true },
        }),
        manager.find(ProductSize, {
          where: { productId: product.id },
          relations: { size: true },
        }),
        manager.find(ProductTag, {
          where: { productId: product.id },
          relations: { tag: true },
        }),
        manager.find(ProductVariant, {
          where: { productId: product.id, isActive: true },
        }),
        manager.find(ProductImage, { where: { productId: product.id } }),
      ]);

    const colorEntities = colorLinks
      .map((link) => link.color)
      .filter((color) => color.isActive)
      .sort(
        (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
      );

    const sizeEntities = sizeLinks
      .map((link) => link.size)
      .filter((size) => size.isActive)
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.code.localeCompare(b.code) ||
          a.id.localeCompare(b.id),
      );

    const tagEntities = tagLinks
      .map((link) => link.tag)
      .filter((tag) => tag.isActive)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

    const colors = colorEntities.map((color) => toPublicColor(color));
    const sizes = sizeEntities.map((size) => toPublicSize(size));
    const tags = tagEntities.map((tag) => toPublicTag(tag));

    const colorById = new Map(colors.map((color) => [color.id, color]));
    const sizeById = new Map(sizes.map((size) => [size.id, size]));
    const colorPosition = new Map(
      colors.map((color, index) => [color.id, index]),
    );
    const sizePosition = new Map(sizes.map((size, index) => [size.id, index]));

    const visibleImages = images
      .filter(
        (image) => image.colorId === null || colorPosition.has(image.colorId),
      )
      .sort((a, b) => {
        const groupA = a.colorId === null ? -1 : (colorPosition.get(a.colorId) ?? 0);
        const groupB = b.colorId === null ? -1 : (colorPosition.get(b.colorId) ?? 0);

        return (
          groupA - groupB ||
          a.sortOrder - b.sortOrder ||
          a.id.localeCompare(b.id)
        );
      });

    const visibleVariants = variants
      .filter(
        (variant) =>
          colorById.has(variant.colorId) &&
          (variant.sizeId === null || sizeById.has(variant.sizeId)),
      )
      .sort((a, b) => {
        const sizeA = a.sizeId === null ? -1 : (sizePosition.get(a.sizeId) ?? 0);
        const sizeB = b.sizeId === null ? -1 : (sizePosition.get(b.sizeId) ?? 0);

        return (
          (colorPosition.get(a.colorId) ?? 0) -
            (colorPosition.get(b.colorId) ?? 0) ||
          sizeA - sizeB ||
          a.id.localeCompare(b.id)
        );
      });

    const publicVariants = visibleVariants.flatMap((variant) => {
      const color = colorById.get(variant.colorId);

      if (!color) {
        return [];
      }

      const item: PublicVariantDto = {
        id: variant.id,
        color,
        size: variant.sizeId ? (sizeById.get(variant.sizeId) ?? null) : null,
        price: variant.price ?? product.price,
        inStock: variant.stockQuantity > 0,
      };

      return [item];
    });

    const category: PublicCategoryDto = {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    };

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDescription: product.shortDescription,
      price: product.price,
      gender: product.gender,
      sizeType: product.sizeType,
      isFeatured: product.isFeatured,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      inStock: publicVariants.some((variant) => variant.inStock),
      category,
      brand: product.brand ? toPublicBrand(product.brand) : null,
      colors,
      sizes,
      tags,
      images: visibleImages.map((image) => this.toPublicImage(image)),
      variants: publicVariants,
    };
  }
}
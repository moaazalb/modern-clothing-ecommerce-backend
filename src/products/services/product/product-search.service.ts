import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';

import { compareMoney } from '../../../common/utils/money.util';
import { escapeLike } from '../../../common/utils/escape-like.util';
import { ProductListQueryDto } from '../../dto/product/product-list-query.dto';
import { Product } from '../../entities/product.entity';
import { ProductSort, ProductStatus } from '../../enums/product.enum';

/**
 * Where the search runs:
 * - public: what a customer may see (ACTIVE, not deleted, effectively active category, active brand);
 * - admin: every product that is not deleted;
 * - trash: only soft-deleted products.
 */
export type ProductSearchScope = 'public' | 'admin' | 'trash';

/**
 * Search criteria: the public filters plus the admin-only ones.
 */
export interface ProductSearchCriteria extends ProductListQueryDto {
  status?: ProductStatus;
  isFeatured?: boolean;
}

/**
 * Result of a search: the ids of the requested page, in order, and the
 * total number of matches.
 */
export interface ProductSearchResult {
  ids: string[];
  total: number;
}

/**
 * Categories that are effectively active: built from the active roots
 * downwards, so a category under an inactive parent is never reached.
 */
const ACTIVE_CATEGORY_IDS_SQL = `
  WITH RECURSIVE "active_tree" AS (
    SELECT "id", 1 AS "level" FROM "categories"
    WHERE "parentId" IS NULL AND "isActive" = true
    UNION ALL
    SELECT c."id", t."level" + 1 FROM "categories" c
    JOIN "active_tree" t ON c."parentId" = t."id"
    WHERE c."isActive" = true AND t."level" < 50
  )
  SELECT "id" FROM "active_tree"`;

/**
 * A category and all its descendants.
 */
const CATEGORY_DESCENDANTS_SQL = `
  WITH RECURSIVE "category_tree" AS (
    SELECT "id", 1 AS "level" FROM "categories" WHERE "id" = :categoryId
    UNION ALL
    SELECT c."id", t."level" + 1 FROM "categories" c
    JOIN "category_tree" t ON c."parentId" = t."id"
    WHERE t."level" < 50
  )
  SELECT "id" FROM "category_tree"`;

/**
 * Buyable variants of the current product: active variant, active color,
 * and a size that is either absent or active.
 */
const BUYABLE_VARIANTS_FROM_SQL = `
  FROM "product_variants" v
  JOIN "colors" vc ON vc."id" = v."colorId"
  LEFT JOIN "sizes" vs ON vs."id" = v."sizeId"
  WHERE v."productId" = "product"."id"
    AND v."isActive" = true
    AND vc."isActive" = true
    AND (v."sizeId" IS NULL OR vs."isActive" = true)`;

/**
 * Price actually charged by a variant: its own price or the product price.
 */
const EFFECTIVE_PRICE_SQL = `COALESCE(v."price", "product"."price")`;

/**
 * Product search engine, shared by the admin lists and the storefront.
 *
 * It returns only ids (ordered and paginated). The callers load the data
 * they need for those ids, so sorting and pagination stay correct.
 */
@Injectable()
export class ProductSearchService {
  /**
   * Injects the data source used to build queries.
   *
   * @param dataSource TypeORM data source.
   */
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Applies the visibility rules of a scope.
   *
   * @param qb Query being built.
   * @param scope Search scope.
   */
  private applyScope(
    qb: SelectQueryBuilder<Product>,
    scope: ProductSearchScope,
  ): void {
    if (scope === 'trash') {
      qb.withDeleted().andWhere('product.deletedAt IS NOT NULL');
      return;
    }

    if (scope === 'public') {
      qb.andWhere('product.status = :activeStatus', {
        activeStatus: ProductStatus.ACTIVE,
      });
      qb.andWhere(`"product"."categoryId" IN (${ACTIVE_CATEGORY_IDS_SQL})`);
      qb.andWhere(
        `("product"."brandId" IS NULL OR EXISTS (
           SELECT 1 FROM "brands" b
           WHERE b."id" = "product"."brandId" AND b."isActive" = true
         ))`,
      );
    }
  }

  /**
   * Applies the filters shared by every scope.
   *
   * @param qb Query being built.
   * @param criteria Search criteria.
   */
  private applyFilters(
    qb: SelectQueryBuilder<Product>,
    criteria: ProductSearchCriteria,
  ): void {
    if (criteria.status) {
      qb.andWhere('product.status = :status', { status: criteria.status });
    }

    if (criteria.isFeatured !== undefined) {
      qb.andWhere('product.isFeatured = :isFeatured', {
        isFeatured: criteria.isFeatured,
      });
    }

    if (criteria.categoryId) {
      qb.andWhere(`"product"."categoryId" IN (${CATEGORY_DESCENDANTS_SQL})`, {
        categoryId: criteria.categoryId,
      });
    }

    if (criteria.brandId) {
      qb.andWhere('product.brandId = :brandId', { brandId: criteria.brandId });
    }

    if (criteria.gender) {
      qb.andWhere('product.gender = :gender', { gender: criteria.gender });
    }

    if (criteria.tagId) {
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM "product_tags" pt
           WHERE pt."productId" = "product"."id" AND pt."tagId" = :tagId
         )`,
        { tagId: criteria.tagId },
      );
    }

    if (criteria.q) {
      qb.andWhere(
        '(product.name ILIKE :search OR product.slug ILIKE :search)',
        { search: `%${escapeLike(criteria.q)}%` },
      );
    }

    this.applyVariantFilters(qb, criteria);
  }

  /**
   * Applies the color, size, stock and price filters. They all apply to
   * the same buyable variant (for example black AND size M AND in stock).
   *
   * @param qb Query being built.
   * @param criteria Search criteria.
   */
  private applyVariantFilters(
    qb: SelectQueryBuilder<Product>,
    criteria: ProductSearchCriteria,
  ): void {
    const conditions: string[] = [];
    const parameters: Record<string, string> = {};

    if (criteria.colorId) {
      conditions.push('v."colorId" = :variantColorId');
      parameters.variantColorId = criteria.colorId;
    }

    if (criteria.sizeId) {
      conditions.push('v."sizeId" = :variantSizeId');
      parameters.variantSizeId = criteria.sizeId;
    }

    if (criteria.inStock) {
      conditions.push('v."stockQuantity" > 0');
    }

    if (criteria.minPrice) {
      conditions.push(`${EFFECTIVE_PRICE_SQL} >= :minPrice`);
      parameters.minPrice = criteria.minPrice;
    }

    if (criteria.maxPrice) {
      conditions.push(`${EFFECTIVE_PRICE_SQL} <= :maxPrice`);
      parameters.maxPrice = criteria.maxPrice;
    }

    if (conditions.length === 0) {
      return;
    }

    qb.andWhere(
      `EXISTS (SELECT 1 ${BUYABLE_VARIANTS_FROM_SQL} AND ${conditions.join(' AND ')})`,
      parameters,
    );
  }

  /**
   * Applies the ordering. The price order uses the lowest effective price
   * among the buyable variants, falling back to the product price.
   *
   * @param qb Query being built.
   * @param criteria Search criteria.
   * @param scope Search scope.
   */
  private applyOrdering(
    qb: SelectQueryBuilder<Product>,
    criteria: ProductSearchCriteria,
    scope: ProductSearchScope,
  ): void {
    if (scope === 'trash') {
      qb.orderBy('product.deletedAt', 'DESC').addOrderBy('product.id', 'DESC');
      return;
    }

    if (
      criteria.sort === ProductSort.PRICE_ASC ||
      criteria.sort === ProductSort.PRICE_DESC
    ) {
      qb.addSelect(
        `COALESCE(
           (SELECT MIN(${EFFECTIVE_PRICE_SQL}) ${BUYABLE_VARIANTS_FROM_SQL}),
           "product"."price"
         )`,
        'effective_price',
      );
      qb.orderBy(
        'effective_price',
        criteria.sort === ProductSort.PRICE_ASC ? 'ASC' : 'DESC',
      ).addOrderBy('product.id', 'ASC');
      return;
    }

    qb.orderBy('product.createdAt', 'DESC').addOrderBy('product.id', 'DESC');
  }

  /**
   * Searches products and returns the ids of the requested page.
   *
   * @param criteria Filters, sort and pagination.
   * @param scope Where the search runs.
   * @returns The ids of the page in order, and the total number of matches.
   * @throws UnprocessableEntityException If minPrice is greater than maxPrice.
   */
  async searchIds(
    criteria: ProductSearchCriteria,
    scope: ProductSearchScope,
  ): Promise<ProductSearchResult> {
    if (
      criteria.minPrice &&
      criteria.maxPrice &&
      compareMoney(criteria.minPrice, criteria.maxPrice) > 0
    ) {
      throw new UnprocessableEntityException(
        'minPrice cannot be greater than maxPrice.',
      );
    }

    const qb = this.dataSource.createQueryBuilder(Product, 'product');

    this.applyScope(qb, scope);
    this.applyFilters(qb, criteria);

    const total = await qb.getCount();

    if (total === 0) {
      return { ids: [], total: 0 };
    }

    qb.select('product.id', 'id');
    this.applyOrdering(qb, criteria, scope);

    const rows = await qb
      .limit(criteria.limit)
      .offset((criteria.page - 1) * criteria.limit)
      .getRawMany<{ id: string }>();

    return { ids: rows.map((row) => row.id), total };
  }
}
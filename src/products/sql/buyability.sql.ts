/**
 * Shared SQL fragments that decide whether a variant can be bought.
 *
 * Used by the Orders module. The same rule currently also exists inside
 * cart.service.ts and product-search.service.ts. A parity test must prove
 * that the three agree before those two are moved to this file.
 *
 * Aliases expected by the fragments:
 * v = product_variants, p = products, vc = colors, vs = sizes, vb = brands.
 */

/**
 * Categories that are effectively active: built from the active roots
 * downwards, so a category under an inactive parent is never reached.
 */
export const ACTIVE_CATEGORY_IDS_SQL = `
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
 * Joins to put after "product_variants v".
 */
export const BUYABLE_JOINS_SQL = `
  JOIN "products" p ON p."id" = v."productId"
  JOIN "colors" vc ON vc."id" = v."colorId"
  LEFT JOIN "sizes" vs ON vs."id" = v."sizeId"
  LEFT JOIN "brands" vb ON vb."id" = p."brandId"`;

/**
 * True when the variant can be shown and bought: active variant, active
 * color and size, ACTIVE and not deleted product, active brand, and an
 * effectively active category.
 */
export const BUYABLE_CONDITION_SQL = `(
  v."isActive" = true
  AND vc."isActive" = true
  AND (v."sizeId" IS NULL OR vs."isActive" = true)
  AND p."status" = 'ACTIVE'
  AND p."deletedAt" IS NULL
  AND (p."brandId" IS NULL OR vb."isActive" = true)
  AND p."categoryId" IN (${ACTIVE_CATEGORY_IDS_SQL})
)`;
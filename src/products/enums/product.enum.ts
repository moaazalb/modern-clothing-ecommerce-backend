/**
 * Target gender of a product.
 *
 * Mirrors the shared PostgreSQL enum type "product_gender".
 * Gender is a standalone product attribute and is not part of categories.
 */
export enum ProductGender {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  UNISEX = 'UNISEX',
}

/**
 * Allowed sort orders for the product listing (whitelist).
 * Price sorting uses the effective price (variant price or product price).
 */
export enum ProductSort {
  NEWEST = 'newest',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
}

/**
 * Publication status of a product.
 *
 * Mirrors the shared PostgreSQL enum type "product_status".
 *
 * DRAFT: being prepared, hidden from customers.
 * ACTIVE: published and available for sale (stock is tracked per variant).
 * ARCHIVED: kept for history, hidden and not purchasable.
 */
export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Machine-readable reasons why a product cannot be published (ACTIVE).
 * The publish endpoint returns all violations together.
 */
export enum PublishViolationCode {
  PRICE_NOT_POSITIVE = 'PRICE_NOT_POSITIVE',
  CATEGORY_INACTIVE = 'CATEGORY_INACTIVE',
  BRAND_INACTIVE = 'BRAND_INACTIVE',
  NO_COLORS = 'NO_COLORS',
  NO_SIZES = 'NO_SIZES',
  VARIANT_MISSING_SIZE = 'VARIANT_MISSING_SIZE',
  NO_ACTIVE_VARIANT = 'NO_ACTIVE_VARIANT',
  NO_IMAGES = 'NO_IMAGES',
}

/**
 * Sizing system used by a product.
 *
 * Mirrors the shared PostgreSQL enum type "size_type".
 * A product that does not need sizes (e.g. bags) has no size type (NULL).
 */
export enum SizeType {
  APPAREL = 'APPAREL',
  FOOTWEAR = 'FOOTWEAR',
}

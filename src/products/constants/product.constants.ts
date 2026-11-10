/**
 * Maximum depth of the category tree (root categories are level 1).
 */
export const CATEGORY_MAX_DEPTH = 4;

/**
 * Key of the PostgreSQL advisory lock that serializes every operation
 * that reads or changes the shape of the category tree.
 */
export const CATEGORY_TREE_LOCK_KEY = 'categories_tree';

/**
 * Maximum size of an uploaded product image (5 MB).
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Maximum number of images of one product (all groups together).
 */
export const MAX_IMAGES_PER_PRODUCT = 20;

/**
 * Slug format: lowercase letters and digits separated by single hyphens.
 * Matches the CHECK constraints in the database.
 */
export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Hex color in the format #RRGGBB (uppercase after normalization).
 */
export const HEX_COLOR_REGEX = /^#[0-9A-F]{6}$/;

/**
 * SKU format: uppercase letters, digits, underscore and hyphen,
 * starting with a letter or digit. Matches the database CHECK constraint.
 */
export const SKU_REGEX = /^[A-Z0-9][A-Z0-9_-]*$/;

/**
 * Maximum stock quantity of a single variant.
 * Matches the limit enforced by the stock DTOs.
 */
export const MAX_STOCK_QUANTITY = 1000000;

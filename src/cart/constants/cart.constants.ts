/**
 * Maximum quantity of the same variant in a cart.
 * The database CHECK (<= 100) is only an absolute safety ceiling.
 */
export const CART_MAX_ITEM_QUANTITY = 10;

/**
 * Maximum number of different variants (lines) in a cart.
 */
export const CART_MAX_LINES = 50;
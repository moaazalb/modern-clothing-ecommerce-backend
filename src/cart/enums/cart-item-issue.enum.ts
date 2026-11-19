/**
 * Why a cart item cannot be bought right now.
 *
 * UNAVAILABLE: the product, variant, color, size, brand or category is not
 * visible or buyable anymore.
 * OUT_OF_STOCK: buyable, but no units are left.
 * INSUFFICIENT_STOCK: fewer units are left than the quantity in the cart.
 */
export enum CartItemIssue {
  UNAVAILABLE = 'UNAVAILABLE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
}
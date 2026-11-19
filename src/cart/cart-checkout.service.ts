import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { CartItem } from './entities/cart-item.entity';

/**
 * A cart line as read at checkout.
 */
export interface CheckoutCartLine {
  variantId: string;
  quantity: number;
}

/**
 * A locked cart with its lines.
 */
export interface LockedCart {
  cartId: string;
  lines: CheckoutCartLine[];
}

/**
 * Cart operations used by the Orders module inside its own transaction.
 *
 * CartService opens its own transactions, so it cannot be used inside the
 * checkout transaction. Every method here works with the EntityManager of
 * the caller.
 */
@Injectable()
export class CartCheckoutService {
  /**
   * Locks the user's cart row for the rest of the transaction and reads
   * its lines ordered by variantId (the same order everywhere, which
   * prevents deadlocks between concurrent checkouts).
   *
   * @param manager Entity manager of the running transaction.
   * @param userId User UUID.
   * @returns The locked cart, or null when the user has no cart.
   */
  async lockCart(
    manager: EntityManager,
    userId: string,
  ): Promise<LockedCart | null> {
    const carts: { id: string }[] = await manager.query(
      `SELECT "id" FROM "carts" WHERE "userId" = $1 FOR UPDATE`,
      [userId],
    );

    const cartId = carts[0]?.id;

    if (!cartId) {
      return null;
    }

    const lines: CheckoutCartLine[] = await manager.query(
      `SELECT "variantId", "quantity" FROM "cart_items"
       WHERE "cartId" = $1 ORDER BY "variantId" ASC`,
      [cartId],
    );

    return { cartId, lines };
  }

  /**
   * Removes every line of a cart.
   *
   * @param manager Entity manager of the running transaction.
   * @param cartId Cart UUID.
   */
  async clear(manager: EntityManager, cartId: string): Promise<void> {
    await manager.delete(CartItem, { cartId });
  }
}
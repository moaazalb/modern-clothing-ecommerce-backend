import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { Product } from '../entities/product.entity';

/**
 * Locks a product row for the rest of the transaction, so changes on the
 * same product (variants, images, publishing) run one after another.
 *
 * @param manager Entity manager of the running transaction.
 * @param productId Product UUID.
 * @returns The locked product.
 * @throws NotFoundException If the product does not exist.
 * @throws ConflictException If the product is soft-deleted.
 */
export async function lockProductForWrite(
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
      'The product is deleted. Restore it before changing it.',
    );
  }

  return product;
}
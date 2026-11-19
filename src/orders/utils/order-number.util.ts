import { randomInt } from 'node:crypto';

import {
  ORDER_NUMBER_ALPHABET,
  ORDER_NUMBER_LENGTH,
  ORDER_NUMBER_PREFIX,
} from '../constants/order.constants';

/**
 * Generates a random, non-sequential order number such as MC-7K3F9Q2X.
 *
 * It uses a cryptographically secure generator, so numbers cannot be
 * guessed and do not reveal how many orders the store has. Uniqueness is
 * guaranteed by the database; the caller retries on a collision.
 *
 * @returns A new order number.
 */
export function generateOrderNumber(): string {
  let code = '';

  for (let index = 0; index < ORDER_NUMBER_LENGTH; index += 1) {
    code += ORDER_NUMBER_ALPHABET.charAt(randomInt(ORDER_NUMBER_ALPHABET.length));
  }

  return `${ORDER_NUMBER_PREFIX}${code}`;
}
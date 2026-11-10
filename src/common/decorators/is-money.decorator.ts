import { Matches } from 'class-validator';

import { MONEY_REGEX } from '../utils/money.util';

/**
 * Validates that a DTO property is a decimal money string.
 *
 * Accepts values such as "55" or "55.00" (up to 8 integer digits and
 * 2 decimals). Rejects negatives, numbers, and extra decimals.
 *
 * Note: this replaces @IsDecimal from the design document, because
 * @IsDecimal accepts negative values and has no upper bound.
 *
 * @returns A property decorator.
 */
export function IsMoney(): PropertyDecorator {
  return Matches(MONEY_REGEX, {
    message:
      '$property must be a decimal string with at most 8 integer digits and 2 decimal places (e.g. "55.00")',
  });
}
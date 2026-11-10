/**
 * Store currency. Final decision: USD for the whole store.
 * It is never stored per product.
 */
export const STORE_CURRENCY = 'USD' as const;

/**
 * Valid money string: up to 8 integer digits and up to 2 decimals.
 * Matches NUMERIC(10,2) (maximum 99999999.99). Negative values are invalid.
 */
export const MONEY_REGEX = /^\d{1,8}(\.\d{1,2})?$/;

/**
 * Checks whether a value is a valid money string such as "55" or "55.00".
 *
 * @param value Value to check.
 * @returns True when the value is a valid money string.
 */
export function isMoney(value: unknown): value is string {
  return typeof value === 'string' && MONEY_REGEX.test(value);
}

/**
 * Converts a money string to integer cents.
 * Money is never handled as a floating-point number.
 *
 * @param value Money string such as "19.99".
 * @returns Amount in cents (e.g. 1999).
 * @throws RangeError When the value is not a valid money string.
 */
export function toCents(value: string): number {
  if (!isMoney(value)) {
    throw new RangeError(`Invalid money value: "${String(value)}"`);
  }

  const [whole, fraction = ''] = value.split('.');

  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/**
 * Converts integer cents to a money string with two decimals.
 *
 * @param cents Non-negative safe integer amount in cents.
 * @returns Money string such as "19.99".
 * @throws RangeError When cents is negative or not a safe integer.
 */
export function fromCents(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError(`Invalid cents value: ${cents}`);
  }

  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');

  return `${whole}.${fraction}`;
}

/**
 * Adds two money strings without floating-point errors.
 *
 * @param a First money string.
 * @param b Second money string.
 * @returns Sum as a money string.
 */
export function addMoney(a: string, b: string): string {
  return fromCents(toCents(a) + toCents(b));
}

/**
 * Multiplies a money string by a whole quantity.
 *
 * @param value Unit price as a money string.
 * @param quantity Non-negative whole number.
 * @returns Total as a money string.
 * @throws RangeError When quantity is not a non-negative integer.
 */
export function multiplyMoney(value: string, quantity: number): string {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError(`Invalid quantity: ${quantity}`);
  }

  return fromCents(toCents(value) * quantity);
}

/**
 * Compares two money strings.
 *
 * @param a First money string.
 * @param b Second money string.
 * @returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compareMoney(a: string, b: string): -1 | 0 | 1 {
  const difference = toCents(a) - toCents(b);

  if (difference < 0) return -1;
  if (difference > 0) return 1;
  return 0;
}
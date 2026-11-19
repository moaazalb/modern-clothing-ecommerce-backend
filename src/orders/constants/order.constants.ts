/**
 * Maximum number of PENDING orders a user can have at the same time
 * (protects cash on delivery from abuse).
 */
export const MAX_OPEN_ORDERS_PER_USER = 5;

/**
 * Prefix of every order number.
 */
export const ORDER_NUMBER_PREFIX = 'MC-';

/**
 * Number of random characters after the prefix.
 */
export const ORDER_NUMBER_LENGTH = 8;

/**
 * Characters of the order number. 32 symbols without the easily confused
 * 0, 1, I and O, so the number can be read over the phone.
 */
export const ORDER_NUMBER_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * How many random order numbers are tried before giving up.
 */
export const ORDER_NUMBER_MAX_ATTEMPTS = 5;

/**
 * Format of the Idempotency-Key header: 16 to 64 letters, digits, "_" or "-".
 */
export const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Default shipping fee in USD. Override it with SHIPPING_FEE_USD.
 */
export const DEFAULT_SHIPPING_FEE = '0.00';
/**
 * Default time (in minutes) a customer has to pay an online order,
 * counted from the moment the order was created.
 */
export const DEFAULT_PAYMENT_WINDOW_MINUTES = 30;

/**
 * Maximum number of expired orders handled in one run of the expiry job.
 */
export const PAYMENT_EXPIRY_BATCH_SIZE = 50;

/**
 * Maximum number of refunds handled in one run of the refund job.
 */
export const REFUND_BATCH_SIZE = 20;

/**
 * A signed webhook older than this (in seconds) is rejected (replay protection).
 */
export const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Name of the development payment provider.
 */
export const MOCK_PROVIDER_NAME = 'mock';

/**
 * Secret used to sign mock webhooks when MOCK_PAYMENT_WEBHOOK_SECRET is not set.
 * The mock provider is refused in production, so this value never protects real money.
 */
export const DEFAULT_MOCK_WEBHOOK_SECRET = 'dev-only-mock-webhook-secret';
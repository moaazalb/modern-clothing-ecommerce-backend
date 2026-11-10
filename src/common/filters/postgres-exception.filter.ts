import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

/**
 * Subset of the PostgreSQL driver error fields used by this filter.
 */
interface PostgresDriverError {
  code?: string;
  constraint?: string;
  table?: string;
}

/**
 * Result of translating a PostgreSQL error to an HTTP error.
 */
interface MappedError {
  status: HttpStatus;
  code: string;
  message: string;
}

/**
 * Friendly messages for specific named constraints.
 * Raw database messages are never sent to clients.
 * Extend this map as new constraints are created in migrations.
 */
const CONSTRAINT_MESSAGES: Readonly<Record<string, string>> = {
  uq_brands_name: 'A brand with this name already exists.',
  uq_brands_slug: 'A brand with this slug already exists.',
  uq_categories_slug: 'A category with this slug already exists.',
  uq_colors_name: 'A color with this name already exists.',
  uq_colors_slug: 'A color with this slug already exists.',
  uq_tags_name: 'A tag with this name already exists.',
  uq_tags_slug: 'A tag with this slug already exists.',
  uq_sizes_name_type: 'A size with this name already exists for this size type.',
  uq_sizes_code_type: 'A size with this code already exists for this size type.',
  uq_products_slug: 'A product with this slug already exists.',
  uq_variants_sku: 'A variant with this SKU already exists.',
  uq_variant_combo_sized:
    'A variant with this color and size already exists for the product.',
  uq_variant_combo_unsized:
    'A variant with this color already exists for the product.',
  uq_images_sort:
    'Another image already uses this sort position in the same group.',
  uq_images_storage_key: 'An image with this storage key already exists.',
  fk_variant_product_color: 'The color does not belong to this product.',
  fk_variant_product_size: 'The size does not belong to this product.',
  fk_image_product_color: 'The color does not belong to this product.',
  fk_ps_size_type: 'The size does not match the size type of the product.',
  fk_ps_product_type: 'The size does not match the size type of the product.',
  chk_categories_no_self_parent: 'A category cannot be its own parent.',
  chk_products_active_price:
    'An active product must have a price greater than zero.',
  chk_variant_stock: 'Stock quantity cannot be negative.',
};

/**
 * Human-readable HTTP error names used in the response body.
 */
const ERROR_NAMES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

/**
 * Global filter that translates PostgreSQL errors into safe HTTP responses.
 *
 * 23505 unique violation        -> 409
 * 23503 foreign key violation   -> 409
 * 23514 check violation         -> 422
 * 23502 not-null violation      -> 422
 * 22P02 / 22001 / 22003 invalid input -> 400
 * 40001 / 40P01 serialization / deadlock -> 409 (client may retry)
 * anything else                 -> 500 with a generic message
 *
 * Database details (query text, values, constraint internals) are only
 * logged on the server and never returned to the client.
 */
@Catch(QueryFailedError)
export class PostgresExceptionFilter
  implements ExceptionFilter<QueryFailedError>
{
  private readonly logger = new Logger(PostgresExceptionFilter.name);

  /**
   * Handles a failed database query.
   *
   * @param exception The TypeORM query error.
   * @param host Current execution context.
   */
  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const driverError = this.extractDriverError(exception);
    const mapped = this.mapError(driverError);

    const logLine = `${driverError.code ?? 'unknown'} constraint=${driverError.constraint ?? '-'} table=${driverError.table ?? '-'}`;

    if (mapped.status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(logLine, exception.stack);
    } else {
      this.logger.warn(logLine);
    }

    response.status(mapped.status).json({
      statusCode: mapped.status,
      error: ERROR_NAMES[mapped.status] ?? 'Error',
      code: mapped.code,
      message: mapped.message,
    });
  }

  /**
   * Reads the underlying PostgreSQL driver error.
   *
   * @param exception The TypeORM query error.
   * @returns The driver error fields.
   */
  private extractDriverError(exception: QueryFailedError): PostgresDriverError {
    const wrapped = exception as unknown as {
      driverError?: PostgresDriverError;
    };

    return wrapped.driverError ?? (exception as unknown as PostgresDriverError);
  }

  /**
   * Translates a PostgreSQL error code into an HTTP error.
   *
   * @param error The driver error fields.
   * @returns Status, machine-readable code, and safe message.
   */
  private mapError(error: PostgresDriverError): MappedError {
    const named = error.constraint
      ? CONSTRAINT_MESSAGES[error.constraint]
      : undefined;

    switch (error.code) {
      case '23505':
        return {
          status: HttpStatus.CONFLICT,
          code: 'UNIQUE_VIOLATION',
          message:
            named ?? 'A record with the same unique value already exists.',
        };
      case '23503':
        return {
          status: HttpStatus.CONFLICT,
          code: 'FOREIGN_KEY_VIOLATION',
          message: named ?? 'The operation conflicts with related records.',
        };
      case '23514':
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          code: 'CHECK_VIOLATION',
          message: named ?? 'The provided data violates a data rule.',
        };
      case '23502':
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          code: 'NOT_NULL_VIOLATION',
          message: 'A required value is missing.',
        };
      case '22P02':
      case '22001':
      case '22003':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'INVALID_INPUT',
          message: 'One of the provided values is invalid.',
        };
      case '40001':
      case '40P01':
        return {
          status: HttpStatus.CONFLICT,
          code: 'CONCURRENT_MODIFICATION',
          message: 'The data was modified concurrently. Please retry.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'INTERNAL_ERROR',
          message: 'Internal server error.',
        };
    }
  }
}
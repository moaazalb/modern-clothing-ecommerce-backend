import { BadRequestException } from '@nestjs/common';

/**
 * Rejects null values in a partial update payload.
 *
 * PartialType makes every DTO property optional, and class-validator treats
 * null as "not provided", so null passes DTO validation even for required
 * fields. Services must call this helper before applying an update.
 *
 * @param payload The update payload (DTO instance).
 * @param nullableFields Names of the fields that may be set to null.
 * @throws BadRequestException If any other field is null.
 */
export function assertNoNullFields(
  payload: object,
  nullableFields: readonly string[] = [],
): void {
  const nullFields = Object.entries(payload)
    .filter(([key, value]) => value === null && !nullableFields.includes(key))
    .map(([key]) => key);

  if (nullFields.length > 0) {
    throw new BadRequestException(
      `These fields cannot be null: ${nullFields.join(', ')}.`,
    );
  }
}
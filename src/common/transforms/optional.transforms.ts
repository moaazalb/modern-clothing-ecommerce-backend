import { Transform } from 'class-transformer';

/**
 * Converts empty (or whitespace-only) strings to undefined.
 *
 * Multipart forms and some clients send "" for an omitted optional field.
 * Combined with @IsOptional(), the field is then treated as not provided.
 *
 * @returns A property decorator.
 */
export function EmptyStringToUndefined(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  );
}
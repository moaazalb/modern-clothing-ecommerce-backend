import { Transform } from 'class-transformer';

/**
 * Removes spaces, hyphens, dots and parentheses from a phone number, so
 * "+963 (912) 345-678" becomes "+963912345678". Non-string values are
 * returned unchanged.
 *
 * @returns A property decorator.
 */
export function NormalizePhone(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s\-().]/g, '') : value,
  );
}
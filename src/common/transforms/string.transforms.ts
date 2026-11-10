import { Transform } from 'class-transformer';

/**
 * Removes leading and trailing whitespace from string values.
 * Non-string values are returned unchanged.
 *
 * @returns A property decorator.
 */
export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}

/**
 * Converts string values to lowercase.
 * Non-string values are returned unchanged.
 *
 * @returns A property decorator.
 */
export function ToLowerCase(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  );
}

/**
 * Converts string values to uppercase.
 * Non-string values are returned unchanged.
 *
 * @returns A property decorator.
 */
export function ToUpperCase(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  );
}

/**
 * Converts the query-string values "true" and "false" to booleans.
 * Any other value is left unchanged so that @IsBoolean() rejects it.
 *
 * Do not use @Type(() => Boolean) for query strings: it converts every
 * non-empty string (including "false") to true.
 *
 * @returns A property decorator.
 */
export function ToBooleanQuery(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  });
}
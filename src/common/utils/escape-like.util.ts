/**
 * Escapes the special characters of a SQL LIKE / ILIKE pattern.
 *
 * The characters %, _ and \ are escaped with a backslash (the PostgreSQL
 * default escape character), so user input is always matched literally.
 *
 * @param value Raw user input.
 * @returns The input with its LIKE wildcards escaped.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
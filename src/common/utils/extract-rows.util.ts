/**
 * Extracts the rows from the result of EntityManager.query().
 *
 * Depending on the statement, the PostgreSQL driver returns either the
 * rows themselves (SELECT) or a pair [rows, rowCount] (UPDATE, DELETE and
 * some INSERT statements with RETURNING). This helper accepts both shapes.
 *
 * @param result Raw result of a query.
 * @returns The rows (an empty array when there are none).
 */
export function extractRows<T>(result: unknown): T[] {
  if (Array.isArray(result) && Array.isArray(result[0])) {
    return result[0] as T[];
  }

  return Array.isArray(result) ? (result as T[]) : [];
}
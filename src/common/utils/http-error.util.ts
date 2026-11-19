import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Human-readable HTTP error names used in the response body.
 */
const ERROR_NAMES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
};

/**
 * Throws an HTTP error with the same body shape as PostgresExceptionFilter:
 * { statusCode, error, code, message }, plus optional extra fields.
 *
 * @param status HTTP status.
 * @param code Machine-readable error code.
 * @param message Human-readable message.
 * @param extra Additional fields added to the body (e.g. a list of items).
 */
export function fail(
  status: HttpStatus,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): never {
  throw new HttpException(
    {
      statusCode: status,
      error: ERROR_NAMES[status] ?? 'Error',
      code,
      message,
      ...extra,
    },
    status,
  );
}
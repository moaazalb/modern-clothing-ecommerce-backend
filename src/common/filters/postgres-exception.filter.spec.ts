import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { PostgresExceptionFilter } from './postgres-exception.filter';

/**
 * Creates a QueryFailedError carrying a PostgreSQL driver error.
 */
function createQueryError(
  driverFields: Record<string, string>,
): QueryFailedError {
  const driverError = Object.assign(new Error('driver error'), driverFields);

  return new QueryFailedError('SELECT 1', [], driverError);
}

describe('PostgresExceptionFilter', () => {
  let filter: PostgresExceptionFilter;
  let json: jest.Mock;
  let status: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    filter = new PostgresExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['23505', HttpStatus.CONFLICT, 'UNIQUE_VIOLATION'],
    ['23503', HttpStatus.CONFLICT, 'FOREIGN_KEY_VIOLATION'],
    ['23514', HttpStatus.UNPROCESSABLE_ENTITY, 'CHECK_VIOLATION'],
    ['23502', HttpStatus.UNPROCESSABLE_ENTITY, 'NOT_NULL_VIOLATION'],
    ['22P02', HttpStatus.BAD_REQUEST, 'INVALID_INPUT'],
    ['40P01', HttpStatus.CONFLICT, 'CONCURRENT_MODIFICATION'],
    ['99999', HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR'],
  ])('maps code %s to status %s', (code, expectedStatus, expectedCode) => {
    filter.catch(createQueryError({ code }), host);

    expect(status).toHaveBeenCalledWith(expectedStatus);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: expectedStatus,
        code: expectedCode,
      }),
    );
  });

  it('uses the friendly message of a known constraint', () => {
    filter.catch(
      createQueryError({ code: '23505', constraint: 'uq_variants_sku' }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'A variant with this SKU already exists.',
      }),
    );
  });

  it('never leaks raw database details', () => {
    filter.catch(
      createQueryError({
        code: '99999',
        detail: 'secret detail',
        table: 'secret_table',
      }),
      host,
    );

    const body = JSON.stringify(json.mock.calls[0][0]);

    expect(body).not.toContain('secret');
  });
});
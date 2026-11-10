import { ApiProperty } from '@nestjs/swagger';

/**
 * Pagination details returned with every paginated list.
 */
export class PaginationMetaDto {
  /**
   * Current page number, starting from 1.
   */
  @ApiProperty({ example: 1 })
  page: number;

  /**
   * Number of items per page.
   */
  @ApiProperty({ example: 20 })
  limit: number;

  /**
   * Total number of items matching the query.
   */
  @ApiProperty({ example: 135 })
  total: number;

  /**
   * Total number of pages.
   */
  @ApiProperty({ example: 7 })
  totalPages: number;
}

/**
 * Generic paginated response. Controllers document the concrete item type
 * in Swagger with an explicit schema.
 */
export class PaginatedResponseDto<T> {
  /**
   * Items of the requested page.
   */
  items: T[];

  /**
   * Pagination details.
   */
  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

/**
 * Builds a paginated response.
 *
 * @param items Items of the requested page.
 * @param total Total number of matching items.
 * @param page Current page number.
 * @param limit Items per page.
 * @returns The paginated response.
 */
export function buildPaginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponseDto<T> {
  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
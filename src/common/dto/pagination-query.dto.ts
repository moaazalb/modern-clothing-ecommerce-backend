import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Common pagination query parameters.
 *
 * Query-string values arrive as strings, so they are converted to numbers
 * before validation. The Swagger type is declared explicitly because
 * TypeScript emits "Object" for properties whose type is only inferred
 * from the default value, which breaks the Swagger UI.
 */
export class PaginationQueryDto {
  /**
   * Page number, starting from 1.
   */
  @ApiPropertyOptional({
    description: 'Page number, starting from 1.',
    type: 'integer',
    default: 1,
    minimum: 1,
    maximum: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  /**
   * Number of items per page.
   */
  @ApiPropertyOptional({
    description: 'Number of items per page.',
    type: 'integer',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Defines the data required to set a variant's stock to an absolute value.
 *
 * The update is atomic and never produces a negative quantity.
 */
export class SetStockDto {
  /**
   * New stock quantity.
   */
  @ApiProperty({
    description: 'New absolute stock quantity.',
    example: 25,
    minimum: 0,
    maximum: 1000000,
  })
  @IsInt()
  @Min(0)
  @Max(1000000)
  stockQuantity: number;
}
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min, NotEquals } from 'class-validator';

/**
 * Defines the data required to change a variant's stock by a delta.
 *
 * A positive delta adds units, a negative delta removes units.
 * The update is atomic and fails if the result would be negative.
 */
export class AdjustStockDto {
  /**
   * Units to add (positive) or remove (negative). Cannot be zero.
   */
  @ApiProperty({
    description: 'Units to add (positive) or remove (negative). Cannot be 0.',
    example: -3,
    minimum: -1000000,
    maximum: 1000000,
  })
  @IsInt()
  @NotEquals(0)
  @Min(-1000000)
  @Max(1000000)
  delta: number;
}
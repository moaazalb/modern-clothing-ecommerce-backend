import { ApiProperty } from '@nestjs/swagger';

import { SizeType } from '../../../enums/product.enum';

/**
 * Size data returned by the admin API.
 */
export class SizeResponseDto {
  /**
   * Unique size identifier.
   */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /**
   * Display name.
   */
  @ApiProperty({ example: 'Small' })
  name: string;

  /**
   * Short code.
   */
  @ApiProperty({ example: 'S' })
  code: string;

  /**
   * Sizing system.
   */
  @ApiProperty({ enum: SizeType, example: SizeType.APPAREL })
  sizeType: SizeType;

  /**
   * Display order inside the sizing system.
   */
  @ApiProperty({ example: 2 })
  sortOrder: number;

  /**
   * Whether the size is active.
   */
  @ApiProperty({ example: true })
  isActive: boolean;

  /**
   * Creation date.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  /**
   * Last update date.
   */
  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}
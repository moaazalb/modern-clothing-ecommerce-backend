import { ApiProperty } from '@nestjs/swagger';

import { SizeType } from '../../../enums/product.enum';

/**
 * Size data returned by the public storefront API.
 */
export class PublicSizeDto {
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
}
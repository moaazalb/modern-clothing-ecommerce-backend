import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { SizeType } from '../../../enums/product.enum';

/**
 * Query parameters of the public size list.
 */
export class PublicSizeListQueryDto {
  /**
   * Filters by sizing system. Omit to get all active sizes.
   */
  @ApiPropertyOptional({ enum: SizeType, enumName: 'SizeType' })
  @IsOptional()
  @IsEnum(SizeType)
  sizeType?: SizeType;
}
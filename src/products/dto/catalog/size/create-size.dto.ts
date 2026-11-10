import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  ToUpperCase,
  Trim,
} from '../../../../common/transforms/string.transforms';
import { SizeType } from '../../../../products/enums/product.enum';

/**
 * Defines the data required to create a size.
 *
 * The same code may exist in both sizing systems, so uniqueness is
 * enforced on (code, sizeType) by the database.
 */
export class CreateSizeDto {
  /**
   * Display name (e.g. Small, Size 42).
   */
  @ApiProperty({
    description: 'Display name of the size.',
    example: 'Small',
    maxLength: 20,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  name: string;

  /**
   * Short code (e.g. S, 42). Normalized to uppercase.
   */
  @ApiProperty({
    description: 'Short size code (stored uppercase).',
    example: 'S',
    maxLength: 20,
  })
  @Trim()
  @ToUpperCase()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  /**
   * Sizing system. It cannot be changed after creation.
   */
  @ApiProperty({
    description: 'Sizing system. Cannot be changed after creation.',
    enum: SizeType,
    example: SizeType.APPAREL,
  })
  @IsEnum(SizeType)
  sizeType: SizeType;

  /**
   * Display order inside the sizing system. Defaults to 0.
   */
  @ApiPropertyOptional({
    description: 'Display order inside the sizing system (0 or greater).',
    default: 0,
    minimum: 0,
    maximum: 1000000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000)
  sortOrder?: number;

  /**
   * Whether the size is active. Defaults to true.
   */
  @ApiPropertyOptional({ description: 'Whether the size is active.', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
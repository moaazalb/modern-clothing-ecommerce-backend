import { ApiProperty } from '@nestjs/swagger';

import { PublishViolationCode } from '../../enums/product.enum';

/**
 * One reason why a product cannot be published.
 */
export class PublishViolationDto {
  /**
   * Machine-readable reason.
   */
  @ApiProperty({
    enum: PublishViolationCode,
    enumName: 'PublishViolationCode',
  })
  code: PublishViolationCode;

  /**
   * Human-readable explanation.
   */
  @ApiProperty({ example: 'The product has no images.' })
  message: string;
}
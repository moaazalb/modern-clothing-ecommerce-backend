import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateSizeDto } from './create-size.dto';

/**
 * Defines the optional fields that can be updated on a size.
 *
 * sizeType is intentionally excluded: changing it would break the
 * composite foreign keys of products that already use the size.
 * Sending it is rejected by the global ValidationPipe
 * (forbidNonWhitelisted).
 *
 * undefined means "no change". SizeService must reject null values,
 * because no size field is nullable.
 */
export class UpdateSizeDto extends PartialType(
  OmitType(CreateSizeDto, ['sizeType'] as const),
) {}
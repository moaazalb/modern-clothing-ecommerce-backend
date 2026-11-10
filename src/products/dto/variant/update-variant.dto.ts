import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateVariantDto } from './create-variant.dto';

/**
 * Defines the optional fields that can be updated on a variant.
 *
 * colorId and sizeId are excluded: changing the combination means creating
 * a new variant. stockQuantity is excluded: stock changes only through the
 * dedicated atomic stock endpoints. Sending any of them is rejected by the
 * global ValidationPipe (forbidNonWhitelisted).
 *
 * undefined means "no change". null is allowed only for price (it means
 * "use the product price"). ProductVariantService must reject null for
 * sku and isActive.
 */
export class UpdateVariantDto extends PartialType(
  OmitType(CreateVariantDto, [
    'colorId',
    'sizeId',
    'stockQuantity',
  ] as const),
) {}
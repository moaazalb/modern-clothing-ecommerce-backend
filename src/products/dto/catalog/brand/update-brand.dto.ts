import { PartialType } from '@nestjs/swagger';

import { CreateBrandDto } from './create-brand.dto';

/**
 * Defines the optional fields that can be updated on a brand.
 *
 * undefined means "no change". null clears only nullable fields
 * (description, logoUrl, websiteUrl). BrandService must reject null for
 * non-nullable fields such as name.
 */
export class UpdateBrandDto extends PartialType(CreateBrandDto) {}
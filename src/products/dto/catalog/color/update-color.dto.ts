import { PartialType } from '@nestjs/swagger';

import { CreateColorDto } from './create-color.dto';

/**
 * Defines the optional fields that can be updated on a color.
 *
 * undefined means "no change". ColorService must reject null values,
 * because no color field is nullable.
 */
export class UpdateColorDto extends PartialType(CreateColorDto) {}
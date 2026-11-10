import { PartialType } from '@nestjs/swagger';

import { CreateTagDto } from './create-tag.dto';

/**
 * Defines the optional fields that can be updated on a tag.
 *
 * undefined means "no change". TagService must reject null values,
 * because no tag field is nullable.
 */
export class UpdateTagDto extends PartialType(CreateTagDto) {}
import { PartialType } from '@nestjs/swagger';

import { CreateCategoryDto } from '../../catalog/category/create-category.dto';

/**
 * Defines the optional fields that can be updated on a category.
 *
 * undefined means "no change". null clears only nullable fields
 * (description, parentId). CategoryService must reject null for
 * non-nullable fields such as name.
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
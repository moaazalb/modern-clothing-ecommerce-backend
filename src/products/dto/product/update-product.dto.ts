import { PartialType } from '@nestjs/swagger';

import { CreateProductDto } from './create-product.dto';

/**
 * Defines the optional fields that can be updated on a product.
 *
 * status is not part of this DTO: it changes only through the publish,
 * unpublish and archive endpoints. Stock is not part of it either: it
 * changes only through the dedicated atomic stock endpoints. Sending any
 * of them is rejected by the global ValidationPipe (forbidNonWhitelisted).
 *
 * undefined means "no change". null is accepted by validation only because
 * PartialType marks every field as optional, so ProductService must reject
 * null for name, slug, price, categoryId, gender and isFeatured. null is a
 * valid "clear the value" for description, shortDescription, brandId,
 * sizeType, metaTitle and metaDescription.
 *
 * Changing sizeType is rejected by the service when the product already has
 * sizes or variants (the database enforces it as well).
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { AdminOnly } from '../../../auth/decorators/admin-only.decorator';
import { AddProductColorDto } from '../../dto/product/add-product-color.dto';
import { AddProductSizeDto } from '../../dto/product/add-product-size.dto';
import { CreateProductDto } from '../../dto/product/create-product.dto';
import { ProductResponseDto } from '../../dto/product/product-response.dto';
import { SetProductTagsDto } from '../../dto/product/set-product-tags.dto';
import { UpdateProductDto } from '../../dto/product/update-product.dto';
import { ProductService } from '../../services/product/product.service';

/**
 * Admin endpoints that create, change and publish products.
 *
 * Listing and details are added with the image support.
 */
@ApiTags('Admin / Products')
@AdminOnly()
@Controller('admin/products')
export class AdminProductsController {
  /**
   * Injects the products service.
   *
   * @param productService Products business logic.
   */
  constructor(private readonly productService: ProductService) {}

  /**
   * Creates a product as DRAFT.
   *
   * @param dto Creation data.
   * @returns The created product.
   */
  @Post()
  @ApiOperation({
    summary: 'Create a product (always DRAFT)',
    description:
      'The slug is generated from the name when omitted (a numeric suffix is added on conflict).',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiConflictResponse({ description: 'The explicit slug is already in use.' })
  @ApiUnprocessableEntityResponse({
    description: 'No slug could be generated, or the category/brand is missing or inactive.',
  })
  create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    return this.productService.create(dto);
  }

  /**
   * Updates a product.
   *
   * @param id Product UUID.
   * @param dto Fields to update.
   * @returns The updated product.
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a product',
    description:
      'Status and stock cannot be changed here. The slug can change only while DRAFT. The size type cannot change once sizes or variants exist.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID.' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid input, or a non-nullable field is null.',
  })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  @ApiConflictResponse({
    description: 'The product is deleted, or the slug/size type cannot change.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid category/brand, or an ACTIVE product would get a price of 0.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productService.update(id, dto);
  }

  /**
   * Soft-deletes a product.
   *
   * @param id Product UUID.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete a product',
    description:
      'Variants, stock, images and relations are kept. The product disappears from the storefront and cannot be bought.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID.' })
  @ApiNoContentResponse({ description: 'The product was deleted.' })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  @ApiConflictResponse({ description: 'The product is already deleted.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.productService.remove(id);
  }

  /**
   * Restores a soft-deleted product as DRAFT.
   *
   * @param id Product UUID.
   * @returns The restored product.
   */
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restore a deleted product',
    description: 'The product comes back as DRAFT and must be published again.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID.' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  @ApiConflictResponse({ description: 'The product is not deleted.' })
  restore(@Param('id', ParseUUIDPipe) id: string): Promise<ProductResponseDto> {
    return this.productService.restore(id);
  }

  /**
   * Publishes a product after validating the publishing rules.
   *
   * @param id Product UUID.
   * @returns The published product.
   */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish a product (status ACTIVE)',
    description:
      'Validates every publishing rule and returns all violations together when it fails.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID.' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  @ApiConflictResponse({ description: 'The product is deleted.' })
  @ApiUnprocessableEntityResponse({
    description:
      'code PRODUCT_NOT_PUBLISHABLE with a "violations" array of { code, message }.',
  })
  publish(@Param('id', ParseUUIDPipe) id: string): Promise<ProductResponseDto> {
    return this.productService.publish(id);
  }

  /**
   * Returns a product to DRAFT.
   *
   * @param id Product UUID.
   * @returns The product as DRAFT.
   */
  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish a product (status DRAFT)' })
  @ApiParam({ name: 'id', description: 'Product UUID.' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  @ApiConflictResponse({ description: 'The product is deleted.' })
  unpublish(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    return this.productService.unpublish(id);
  }

  /**
   * Archives a product.
   *
   * @param id Product UUID.
   * @returns The archived product.
   */
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a product (status ARCHIVED)' })
  @ApiParam({ name: 'id', description: 'Product UUID.' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  @ApiConflictResponse({ description: 'The product is deleted.' })
  archive(@Param('id', ParseUUIDPipe) id: string): Promise<ProductResponseDto> {
    return this.productService.archive(id);
  }

  /**
   * Links a color to a product.
   *
   * @param id Product UUID.
   * @param dto The color to link.
   */
  @Post(':id/colors')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Link a color to a product' })
  @ApiParam({ name: 'id', description: 'Product UUID.' })
  @ApiNoContentResponse({ description: 'The color was linked.' })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  @ApiConflictResponse({
    description: 'The product is deleted, or the color is already linked.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'The color does not exist or is inactive.',
  })
  addColor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddProductColorDto,
  ): Promise<void> {
    return this.productService.addColor(id, dto);
  }

  /**
   * Unlinks a color from a product.
   *
   * @param id Product UUID.
   * @param colorId Color UUID.
   */
  @Delete(':id/colors/:colorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Unlink a color from a product',
    description:
      'Rejected while a variant or an image of the product uses the color.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID.' })
  @ApiParam({ name: 'colorId', description: 'Color UUID.' })
  @ApiNoContentResponse({ description: 'The color was unlinked.' })
  @ApiNotFoundResponse({
    description: 'The product does not exist, or the color is not linked.',
  })
  @ApiConflictResponse({
    description: 'The product is deleted, or the color is in use.',
  })
  removeColor(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('colorId', ParseUUIDPipe) colorId: string,
  ): Promise<void> {
    return this.productService.removeColor(id, colorId);
  }

  /**
   * Links a size to a product.
   *
   * @param id Product UUID.
   * @param dto The size to link.
   */
  @Post(':id/sizes')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Link a size to a product' })
  @ApiParam({ name: 'id', description: 'Product UUID.' })
  @ApiNoContentResponse({ description: 'The size was linked.' })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  @ApiConflictResponse({
    description: 'The product is deleted, or the size is already linked.',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'The product has no size type, or the size is missing, inactive or from another size system.',
  })
  addSize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddProductSizeDto,
  ): Promise<void> {
    return this.productService.addSize(id, dto);
  }

  /**
   * Unlinks a size from a product.
   *
   * @param id Product UUID.
   * @param sizeId Size UUID.
   */
  @Delete(':id/sizes/:sizeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Unlink a size from a product',
    description: 'Rejected while a variant of the product uses the size.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID.' })
  @ApiParam({ name: 'sizeId', description: 'Size UUID.' })
  @ApiNoContentResponse({ description: 'The size was unlinked.' })
  @ApiNotFoundResponse({
    description: 'The product does not exist, or the size is not linked.',
  })
  @ApiConflictResponse({
    description: 'The product is deleted, or the size is in use.',
  })
  removeSize(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sizeId', ParseUUIDPipe) sizeId: string,
  ): Promise<void> {
    return this.productService.removeSize(id, sizeId);
  }

  /**
   * Replaces the whole set of tags of a product.
   *
   * @param id Product UUID.
   * @param dto The complete list of tag identifiers.
   */
  @Put(':id/tags')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Replace the tags of a product',
    description:
      'Send the complete list. An empty array removes all tags. Already linked tags stay even if inactive; new tags must be active.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID.' })
  @ApiNoContentResponse({ description: 'The tags were replaced.' })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  @ApiConflictResponse({ description: 'The product is deleted.' })
  @ApiUnprocessableEntityResponse({
    description: 'A new tag does not exist or is inactive.',
  })
  setTags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetProductTagsDto,
  ): Promise<void> {
    return this.productService.setTags(id, dto);
  }
}
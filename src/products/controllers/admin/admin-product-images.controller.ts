import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';

import { AdminOnly } from '../../../auth/decorators/admin-only.decorator';
import { MAX_IMAGE_BYTES } from '../../constants/product.constants';
import { ImageResponseDto } from '../../dto/image/image-response.dto';
import { ReorderImagesDto } from '../../dto/image/reorder-images.dto';
import { UpdateImageDto } from '../../dto/image/update-image.dto';
import { UploadImageDto } from '../../dto/image/upload-image.dto';
import { ProductImageService } from '../../services/product/product-image.service';

/**
 * Admin endpoints for the images of a product.
 */
@ApiTags('Admin / Product Images')
@AdminOnly()
@Controller('admin/products/:productId/images')
export class AdminProductImagesController {
  /**
   * Injects the images service.
   *
   * @param imageService Images business logic.
   */
  constructor(private readonly imageService: ProductImageService) {}

  /**
   * Uploads an image.
   *
   * @param productId Product UUID.
   * @param file The uploaded file.
   * @param dto Optional color and alt text.
   * @returns The created image.
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JPEG, PNG or WebP image, up to 5 MB.',
        },
        colorId: {
          type: 'string',
          format: 'uuid',
          description: 'Optional. Omit for a general image.',
        },
        altText: { type: 'string', maxLength: 255 },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload an image',
    description:
      'The image is added at the end of its group (general images, or the images of one color).',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID.' })
  @ApiCreatedResponse({ type: ImageResponseDto })
  @ApiBadRequestResponse({ description: 'No file, or invalid fields.' })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  @ApiConflictResponse({ description: 'The product is deleted.' })
  @ApiUnsupportedMediaTypeResponse({
    description: 'The file is not a JPEG, PNG or WebP image.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Too many images, or the color is not linked to the product.',
  })
  upload(
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadImageDto,
  ): Promise<ImageResponseDto> {
    return this.imageService.upload(productId, file, dto);
  }

  /**
   * Lists the images of a product.
   *
   * @param productId Product UUID.
   * @returns The images (general first, then by color group).
   */
  @Get()
  @ApiOperation({ summary: 'List the images of a product' })
  @ApiParam({ name: 'productId', description: 'Product UUID.' })
  @ApiOkResponse({ type: ImageResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  findAll(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ImageResponseDto[]> {
    return this.imageService.findAll(productId);
  }

  /**
   * Reorders the images of one group.
   *
   * @param productId Product UUID.
   * @param dto The group and the images in the new order.
   * @returns The images of the group in their new order.
   */
  @Put('order')
  @ApiOperation({
    summary: 'Reorder the images of a group',
    description:
      'Send every image of the group in the desired order. The first one becomes the main image.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID.' })
  @ApiOkResponse({ type: ImageResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Invalid or duplicated ids.' })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  @ApiConflictResponse({ description: 'The product is deleted.' })
  @ApiUnprocessableEntityResponse({
    description: 'The list does not match the images of the group exactly.',
  })
  reorder(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: ReorderImagesDto,
  ): Promise<ImageResponseDto[]> {
    return this.imageService.reorder(productId, dto);
  }

  /**
   * Updates the alt text of an image.
   *
   * @param productId Product UUID.
   * @param imageId Image UUID.
   * @param dto New alt text.
   * @returns The updated image.
   */
  @Patch(':imageId')
  @ApiOperation({ summary: 'Update the alt text of an image' })
  @ApiParam({ name: 'productId', description: 'Product UUID.' })
  @ApiParam({ name: 'imageId', description: 'Image UUID.' })
  @ApiOkResponse({ type: ImageResponseDto })
  @ApiNotFoundResponse({ description: 'Product or image not found.' })
  @ApiConflictResponse({ description: 'The product is deleted.' })
  updateAltText(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateImageDto,
  ): Promise<ImageResponseDto> {
    return this.imageService.updateAltText(productId, imageId, dto);
  }

  /**
   * Deletes an image.
   *
   * @param productId Product UUID.
   * @param imageId Image UUID.
   */
  @Delete(':imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an image',
    description:
      'Deletes the record and then the file. The other images keep their positions.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID.' })
  @ApiParam({ name: 'imageId', description: 'Image UUID.' })
  @ApiNoContentResponse({ description: 'The image was deleted.' })
  @ApiNotFoundResponse({ description: 'Product or image not found.' })
  @ApiConflictResponse({ description: 'The product is deleted.' })
  @ApiUnprocessableEntityResponse({
    description: 'It is the last image of an ACTIVE product.',
  })
  remove(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ): Promise<void> {
    return this.imageService.remove(productId, imageId);
  }
}
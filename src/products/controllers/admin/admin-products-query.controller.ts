import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { AdminOnly } from '../../../auth/decorators/admin-only.decorator';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { AdminProductDetailDto } from '../../dto/product/admin-product-detail.dto';
import { AdminProductListQueryDto } from '../../dto/product/admin-product-list-query.dto';
import { ProductResponseDto } from '../../dto/product/product-response.dto';
import { AdminProductQueryService } from '../../services/admin/admin-product-query.service';

/**
 * Admin endpoints that read products (list, trash, details).
 *
 * The write endpoints live in AdminProductsController. The "trash" route is
 * declared before ":id" so it is not mistaken for an id.
 */
@ApiTags('Admin / Products')
@AdminOnly()
@Controller('admin/products')
export class AdminProductsQueryController {
  /**
   * Injects the admin product query service.
   *
   * @param queryService Admin read operations.
   */
  constructor(private readonly queryService: AdminProductQueryService) {}

  /**
   * Lists products that are not deleted.
   *
   * @param query Filters, sorting and pagination.
   * @returns A page of products.
   */
  @Get()
  @ApiOperation({
    summary: 'List products (paginated)',
    description:
      'Same filters as the storefront plus status and isFeatured. Color, size, stock and price filters look at buyable variants (active variant, active color and size) and apply to the same variant. Price sorting uses the lowest effective price.',
  })
  @ApiPaginatedResponse(ProductResponseDto)
  @ApiUnprocessableEntityResponse({
    description: 'minPrice is greater than maxPrice.',
  })
  findAll(
    @Query() query: AdminProductListQueryDto,
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    return this.queryService.findAll(query);
  }

  /**
   * Lists soft-deleted products.
   *
   * @param query Pagination parameters.
   * @returns A page of deleted products.
   */
  @Get('trash')
  @ApiOperation({
    summary: 'List deleted products (trash)',
    description: 'Most recently deleted first. Use restore to bring one back.',
  })
  @ApiPaginatedResponse(ProductResponseDto)
  findTrash(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<ProductResponseDto>> {
    return this.queryService.findTrash(query);
  }

  /**
   * Retrieves a product with everything related to it.
   *
   * @param id Product UUID.
   * @returns The product details.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a product with its related records',
    description:
      'Includes the category, brand, colors, sizes, tags, all variants and all images. Deleted products can be read too.',
  })
  @ApiParam({ name: 'id', description: 'Product UUID.' })
  @ApiOkResponse({ type: AdminProductDetailDto })
  @ApiBadRequestResponse({ description: 'Invalid UUID format.' })
  @ApiNotFoundResponse({ description: 'The product does not exist.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminProductDetailDto> {
    return this.queryService.findOne(id);
  }
}
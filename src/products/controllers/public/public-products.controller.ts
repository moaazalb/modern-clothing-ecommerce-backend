import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { ProductListQueryDto } from '../../dto/product/product-list-query.dto';
import { PublicProductDetailDto } from '../../dto/product/public-product-detail.dto';
import { PublicProductListItemDto } from '../../dto/product/public-product-list-item.dto';
import { PublicProductService } from '../../services/public/public-product.service';

/**
 * Public storefront endpoints for products (no authentication).
 *
 * They return only products that customers may see. The global throttler
 * already rate-limits every route.
 */
@ApiTags('Public / Products')
@Controller('products')
export class PublicProductsController {
  /**
   * Injects the public product service.
   *
   * @param publicProductService Storefront product logic.
   */
  constructor(private readonly publicProductService: PublicProductService) {}

  /**
   * Lists visible products with filters, sorting and pagination.
   *
   * @param query List filters, sort and pagination.
   * @returns A page of product cards.
   */
  @Get()
  @ApiOperation({ summary: 'List products (filters, sort, pagination)' })
  @ApiPaginatedResponse(PublicProductListItemDto)
  @ApiUnprocessableEntityResponse({
    description: 'minPrice is greater than maxPrice.',
  })
  findAll(
    @Query() query: ProductListQueryDto,
  ): Promise<PaginatedResponseDto<PublicProductListItemDto>> {
    return this.publicProductService.findAll(query);
  }

  /**
   * Retrieves the page of one product.
   *
   * @param slug Product slug.
   * @returns The product details.
   */
  @Get(':slug')
  @ApiOperation({ summary: 'Get a product by slug' })
  @ApiOkResponse({ type: PublicProductDetailDto })
  @ApiNotFoundResponse({
    description: 'The product does not exist or is not visible.',
  })
  findOne(@Param('slug') slug: string): Promise<PublicProductDetailDto> {
    return this.publicProductService.findBySlug(slug);
  }
}
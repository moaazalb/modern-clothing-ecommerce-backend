import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PublicBrandDto } from '../../dto/catalog/brand/public-brand.dto';
import { PublicCategoryTreeNodeDto } from '../../dto/catalog/category/public-category-tree-node.dto';
import { PublicColorDto } from '../../dto/catalog/color/public-color.dto';
import { PublicSizeListQueryDto } from '../../dto/catalog/size/public-size-list-query.dto';
import { PublicSizeDto } from '../../dto/catalog/size/public-size.dto';
import { PublicTagDto } from '../../dto/catalog/tag/public-tag.dto';
import { PublicCatalogService } from '../../services/public/public-catalog.service';

/**
 * Public storefront endpoints for reference data (no authentication).
 *
 * They return only active records and feed menus and filters. The global
 * throttler already rate-limits every route.
 */
@ApiTags('Public / Catalog')
@Controller()
export class PublicCatalogController {
  /**
   * Injects the public catalog service.
   *
   * @param publicCatalogService Storefront reference-data logic.
   */
  constructor(private readonly publicCatalogService: PublicCatalogService) {}

  /**
   * Returns the category tree.
   *
   * @returns Root categories with nested children.
   */
  @Get('categories/tree')
  @ApiOperation({ summary: 'Category tree (effectively active only)' })
  @ApiOkResponse({ type: [PublicCategoryTreeNodeDto] })
  getCategoryTree(): Promise<PublicCategoryTreeNodeDto[]> {
    return this.publicCatalogService.getCategoryTree();
  }

  /**
   * Lists the active brands.
   *
   * @returns Active brands.
   */
  @Get('brands')
  @ApiOperation({ summary: 'Active brands (for filters)' })
  @ApiOkResponse({ type: [PublicBrandDto] })
  getBrands(): Promise<PublicBrandDto[]> {
    return this.publicCatalogService.getBrands();
  }

  /**
   * Lists the active colors.
   *
   * @returns Active colors.
   */
  @Get('colors')
  @ApiOperation({ summary: 'Active colors (for filters)' })
  @ApiOkResponse({ type: [PublicColorDto] })
  getColors(): Promise<PublicColorDto[]> {
    return this.publicCatalogService.getColors();
  }

  /**
   * Lists the active sizes.
   *
   * @param query Optional sizing-system filter.
   * @returns Active sizes.
   */
  @Get('sizes')
  @ApiOperation({ summary: 'Active sizes (for filters)' })
  @ApiOkResponse({ type: [PublicSizeDto] })
  getSizes(@Query() query: PublicSizeListQueryDto): Promise<PublicSizeDto[]> {
    return this.publicCatalogService.getSizes(query.sizeType);
  }

  /**
   * Lists the active tags.
   *
   * @returns Active tags.
   */
  @Get('tags')
  @ApiOperation({ summary: 'Active tags (for filters)' })
  @ApiOkResponse({ type: [PublicTagDto] })
  getTags(): Promise<PublicTagDto[]> {
    return this.publicCatalogService.getTags();
  }
}
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
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AdminOnly } from '../../../auth/decorators/admin-only.decorator';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { BrandResponseDto } from '../../dto/catalog/brand/brand-response.dto';
import { CreateBrandDto } from '../../dto/catalog/brand/create-brand.dto';
import { UpdateBrandDto } from '../../dto/catalog/brand/update-brand.dto';
import { CatalogListQueryDto } from '../../dto/catalog/catalog-list-query.dto';
import { BrandService } from '../../services/brand/brand.service';

/**
 * Admin endpoints for brands.
 */
@ApiTags('Admin / Brands')
@AdminOnly()
@Controller('admin/brands')
export class AdminBrandsController {
  /**
   * Injects the brands service.
   *
   * @param brandService Brands business logic.
   */
  constructor(private readonly brandService: BrandService) {}

  /**
   * Creates a brand.
   *
   * @param dto Creation data.
   * @returns The created brand.
   */
  @Post()
  @ApiOperation({ summary: 'Create a brand' })
  @ApiCreatedResponse({ type: BrandResponseDto })
  @ApiConflictResponse({ description: 'The name or the slug is in use.' })
  create(@Body() dto: CreateBrandDto): Promise<BrandResponseDto> {
    return this.brandService.create(dto);
  }

  /**
   * Lists brands.
   *
   * @param query List filters and pagination.
   * @returns A page of brands.
   */
  @Get()
  @ApiOperation({ summary: 'List brands (paginated)' })
  @ApiPaginatedResponse(BrandResponseDto)
  findAll(
    @Query() query: CatalogListQueryDto,
  ): Promise<PaginatedResponseDto<BrandResponseDto>> {
    return this.brandService.findAll(query);
  }

  /**
   * Retrieves a brand.
   *
   * @param id Brand UUID.
   * @returns The brand.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a brand by ID' })
  @ApiOkResponse({ type: BrandResponseDto })
  @ApiNotFoundResponse({ description: 'The brand does not exist.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<BrandResponseDto> {
    return this.brandService.findOne(id);
  }

  /**
   * Updates a brand.
   *
   * @param id Brand UUID.
   * @param dto Fields to update.
   * @returns The updated brand.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a brand' })
  @ApiOkResponse({ type: BrandResponseDto })
  @ApiNotFoundResponse({ description: 'The brand does not exist.' })
  @ApiConflictResponse({ description: 'The name or the slug is in use.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandDto,
  ): Promise<BrandResponseDto> {
    return this.brandService.update(id, dto);
  }

  /**
   * Deletes a brand that no product uses.
   *
   * @param id Brand UUID.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an unused brand' })
  @ApiNoContentResponse({ description: 'The brand was deleted.' })
  @ApiNotFoundResponse({ description: 'The brand does not exist.' })
  @ApiConflictResponse({ description: 'The brand is used by products.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.brandService.remove(id);
  }
}
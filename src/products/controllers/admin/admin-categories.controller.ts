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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { AdminOnly } from '../../../auth/decorators/admin-only.decorator';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';
import { CatalogListQueryDto } from '../../dto/catalog/catalog-list-query.dto';
import { CategoryResponseDto } from '../../dto/catalog/category/category-response.dto';
import { CreateCategoryDto } from '../../dto/catalog/category/create-category.dto';
import { UpdateCategoryDto } from '../../dto/catalog/category/update-category.dto';
import { CategoryService } from '../../services/category/category.service';

/**
 * Admin endpoints for categories.
 */
@ApiTags('Admin / Categories')
@AdminOnly()
@Controller('admin/categories')
export class AdminCategoriesController {
  /**
   * Injects the categories service.
   *
   * @param categoryService Categories business logic.
   */
  constructor(private readonly categoryService: CategoryService) {}

  /**
   * Creates a category.
   *
   * @param dto Creation data.
   * @returns The created category.
   */
  @Post()
  @ApiOperation({ summary: 'Create a category' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiConflictResponse({ description: 'The slug is already in use.' })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid parent, depth limit exceeded, or no slug.',
  })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.categoryService.create(dto);
  }

  /**
   * Lists categories.
   *
   * @param query List filters and pagination.
   * @returns A page of categories.
   */
  @Get()
  @ApiOperation({ summary: 'List categories (paginated)' })
  @ApiPaginatedResponse(CategoryResponseDto)
  findAll(
    @Query() query: CatalogListQueryDto,
  ): Promise<PaginatedResponseDto<CategoryResponseDto>> {
    return this.categoryService.findAll(query);
  }

  /**
   * Retrieves a category.
   *
   * @param id Category UUID.
   * @returns The category.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a category by ID' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'The category does not exist.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.findOne(id);
  }

  /**
   * Updates a category, including moving it in the tree.
   *
   * @param id Category UUID.
   * @param dto Fields to update.
   * @returns The updated category.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update or move a category' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'The category does not exist.' })
  @ApiConflictResponse({
    description: 'The slug is in use, or the move would create a cycle.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Invalid parent or depth limit exceeded.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.update(id, dto);
  }

  /**
   * Deletes a category that has no children and no products.
   *
   * @param id Category UUID.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an unused category' })
  @ApiNoContentResponse({ description: 'The category was deleted.' })
  @ApiNotFoundResponse({ description: 'The category does not exist.' })
  @ApiConflictResponse({
    description: 'The category has children or products.',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categoryService.remove(id);
  }
}
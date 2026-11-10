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
import { CatalogListQueryDto } from '../../dto/catalog/catalog-list-query.dto';
import { ColorResponseDto } from '../../dto/catalog/color/color-response.dto';
import { CreateColorDto } from '../../dto/catalog/color/create-color.dto';
import { UpdateColorDto } from '../../dto/catalog/color/update-color.dto';
import { ColorService } from '../../services/color/color.service';

/**
 * Admin endpoints for colors.
 */
@ApiTags('Admin / Colors')
@AdminOnly()
@Controller('admin/colors')
export class AdminColorsController {
  /**
   * Injects the colors service.
   *
   * @param colorService Colors business logic.
   */
  constructor(private readonly colorService: ColorService) {}

  /**
   * Creates a color.
   *
   * @param dto Creation data.
   * @returns The created color.
   */
  @Post()
  @ApiOperation({ summary: 'Create a color' })
  @ApiCreatedResponse({ type: ColorResponseDto })
  @ApiConflictResponse({ description: 'The name or the slug is in use.' })
  create(@Body() dto: CreateColorDto): Promise<ColorResponseDto> {
    return this.colorService.create(dto);
  }

  /**
   * Lists colors.
   *
   * @param query List filters and pagination.
   * @returns A page of colors.
   */
  @Get()
  @ApiOperation({ summary: 'List colors (paginated)' })
  @ApiPaginatedResponse(ColorResponseDto)
  findAll(
    @Query() query: CatalogListQueryDto,
  ): Promise<PaginatedResponseDto<ColorResponseDto>> {
    return this.colorService.findAll(query);
  }

  /**
   * Retrieves a color.
   *
   * @param id Color UUID.
   * @returns The color.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a color by ID' })
  @ApiOkResponse({ type: ColorResponseDto })
  @ApiNotFoundResponse({ description: 'The color does not exist.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ColorResponseDto> {
    return this.colorService.findOne(id);
  }

  /**
   * Updates a color.
   *
   * @param id Color UUID.
   * @param dto Fields to update.
   * @returns The updated color.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a color' })
  @ApiOkResponse({ type: ColorResponseDto })
  @ApiNotFoundResponse({ description: 'The color does not exist.' })
  @ApiConflictResponse({ description: 'The name or the slug is in use.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateColorDto,
  ): Promise<ColorResponseDto> {
    return this.colorService.update(id, dto);
  }

  /**
   * Deletes a color that no product uses.
   *
   * @param id Color UUID.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an unused color' })
  @ApiNoContentResponse({ description: 'The color was deleted.' })
  @ApiNotFoundResponse({ description: 'The color does not exist.' })
  @ApiConflictResponse({ description: 'The color is used by products.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.colorService.remove(id);
  }
}
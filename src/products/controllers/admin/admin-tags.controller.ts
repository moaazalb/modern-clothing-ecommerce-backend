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
import { CreateTagDto } from '../../dto/catalog/tag/create-tag.dto';
import { TagResponseDto } from '../../dto/catalog/tag/tag-response.dto';
import { UpdateTagDto } from '../../dto/catalog/tag/update-tag.dto';
import { TagService } from '../../services/tag/tag.service';

/**
 * Admin endpoints for tags.
 */
@ApiTags('Admin / Tags')
@AdminOnly()
@Controller('admin/tags')
export class AdminTagsController {
  /**
   * Injects the tags service.
   *
   * @param tagService Tags business logic.
   */
  constructor(private readonly tagService: TagService) {}

  /**
   * Creates a tag.
   *
   * @param dto Creation data.
   * @returns The created tag.
   */
  @Post()
  @ApiOperation({ summary: 'Create a tag' })
  @ApiCreatedResponse({ type: TagResponseDto })
  @ApiConflictResponse({ description: 'The name or the slug is in use.' })
  create(@Body() dto: CreateTagDto): Promise<TagResponseDto> {
    return this.tagService.create(dto);
  }

  /**
   * Lists tags.
   *
   * @param query List filters and pagination.
   * @returns A page of tags.
   */
  @Get()
  @ApiOperation({ summary: 'List tags (paginated)' })
  @ApiPaginatedResponse(TagResponseDto)
  findAll(
    @Query() query: CatalogListQueryDto,
  ): Promise<PaginatedResponseDto<TagResponseDto>> {
    return this.tagService.findAll(query);
  }

  /**
   * Retrieves a tag.
   *
   * @param id Tag UUID.
   * @returns The tag.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a tag by ID' })
  @ApiOkResponse({ type: TagResponseDto })
  @ApiNotFoundResponse({ description: 'The tag does not exist.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TagResponseDto> {
    return this.tagService.findOne(id);
  }

  /**
   * Updates a tag.
   *
   * @param id Tag UUID.
   * @param dto Fields to update.
   * @returns The updated tag.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a tag' })
  @ApiOkResponse({ type: TagResponseDto })
  @ApiNotFoundResponse({ description: 'The tag does not exist.' })
  @ApiConflictResponse({ description: 'The name or the slug is in use.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagDto,
  ): Promise<TagResponseDto> {
    return this.tagService.update(id, dto);
  }

  /**
   * Deletes a tag that no product uses.
   *
   * @param id Tag UUID.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an unused tag' })
  @ApiNoContentResponse({ description: 'The tag was deleted.' })
  @ApiNotFoundResponse({ description: 'The tag does not exist.' })
  @ApiConflictResponse({ description: 'The tag is used by products.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tagService.remove(id);
  }
}
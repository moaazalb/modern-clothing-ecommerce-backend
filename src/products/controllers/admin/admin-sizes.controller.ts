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
import { CreateSizeDto } from '../../dto/catalog/size/create-size.dto';
import { SizeListQueryDto } from '../../dto/catalog/size/size-list-query.dto';
import { SizeResponseDto } from '../../dto/catalog/size/size-response.dto';
import { UpdateSizeDto } from '../../dto/catalog/size/update-size.dto';
import { SizeService } from '../../services/size/size.service';

/**
 * Admin endpoints for sizes.
 */
@ApiTags('Admin / Sizes')
@AdminOnly()
@Controller('admin/sizes')
export class AdminSizesController {
  /**
   * Injects the sizes service.
   *
   * @param sizeService Sizes business logic.
   */
  constructor(private readonly sizeService: SizeService) {}

  /**
   * Creates a size.
   *
   * @param dto Creation data.
   * @returns The created size.
   */
  @Post()
  @ApiOperation({ summary: 'Create a size' })
  @ApiCreatedResponse({ type: SizeResponseDto })
  @ApiConflictResponse({
    description: 'The name or the code is in use for this sizing system.',
  })
  create(@Body() dto: CreateSizeDto): Promise<SizeResponseDto> {
    return this.sizeService.create(dto);
  }

  /**
   * Lists sizes.
   *
   * @param query List filters and pagination.
   * @returns A page of sizes.
   */
  @Get()
  @ApiOperation({ summary: 'List sizes (paginated)' })
  @ApiPaginatedResponse(SizeResponseDto)
  findAll(
    @Query() query: SizeListQueryDto,
  ): Promise<PaginatedResponseDto<SizeResponseDto>> {
    return this.sizeService.findAll(query);
  }

  /**
   * Retrieves a size.
   *
   * @param id Size UUID.
   * @returns The size.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a size by ID' })
  @ApiOkResponse({ type: SizeResponseDto })
  @ApiNotFoundResponse({ description: 'The size does not exist.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<SizeResponseDto> {
    return this.sizeService.findOne(id);
  }

  /**
   * Updates a size. The sizing system cannot be changed.
   *
   * @param id Size UUID.
   * @param dto Fields to update.
   * @returns The updated size.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a size (sizeType cannot change)' })
  @ApiOkResponse({ type: SizeResponseDto })
  @ApiNotFoundResponse({ description: 'The size does not exist.' })
  @ApiConflictResponse({
    description: 'The name or the code is in use for this sizing system.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSizeDto,
  ): Promise<SizeResponseDto> {
    return this.sizeService.update(id, dto);
  }

  /**
   * Deletes a size that no product uses.
   *
   * @param id Size UUID.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an unused size' })
  @ApiNoContentResponse({ description: 'The size was deleted.' })
  @ApiNotFoundResponse({ description: 'The size does not exist.' })
  @ApiConflictResponse({ description: 'The size is used by products.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.sizeService.remove(id);
  }
}
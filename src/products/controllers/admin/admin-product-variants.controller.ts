import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { Roles } from '../../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { UserRole } from '../../../users/entities/user.entity';
import { AdjustStockDto } from '../../dto/variant/adjust-stock.dto';
import { CreateVariantDto } from '../../dto/variant/create-variant.dto';
import { SetStockDto } from '../../dto/variant/set-stock.dto';
import { UpdateVariantDto } from '../../dto/variant/update-variant.dto';
import { VariantResponseDto } from '../../dto/variant/variant-response.dto';
import { ProductVariantService } from '../../services/product/product-variant.service';
import { StockService } from '../../services/stock/stock.service';

/**
 * Admin controller for the variants and the stock of a product.
 *
 * All routes require an authenticated administrator.
 */
@ApiTags('Admin - Product Variants')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'Administrator role required.' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/products/:productId/variants')
export class AdminProductVariantsController {
  /**
   * Injects the services that handle variants and stock.
   *
   * @param variantService Variant business logic.
   * @param stockService Stock business logic.
   */
  constructor(
    private readonly variantService: ProductVariantService,
    private readonly stockService: StockService,
  ) {}

  /**
   * Creates a variant.
   *
   * POST /admin/products/:productId/variants
   *
   * @param productId Product UUID.
   * @param dto Variant data.
   * @returns The created variant.
   */
  @Post()
  @ApiOperation({
    summary: 'Create a variant',
    description:
      'Creates a color + size combination for the product. The color and size must already be linked to the product.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID.' })
  @ApiCreatedResponse({ type: VariantResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid input data.' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @ApiConflictResponse({
    description: 'Duplicate sku or combination, or the product is deleted.',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Size rule violated, or the color/size is not linked to the product or is inactive.',
  })
  create(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body() dto: CreateVariantDto,
  ): Promise<VariantResponseDto> {
    return this.variantService.create(productId, dto);
  }

  /**
   * Lists the variants of a product.
   *
   * GET /admin/products/:productId/variants
   *
   * @param productId Product UUID.
   * @returns The variants of the product.
   */
  @Get()
  @ApiOperation({ summary: 'List the variants of a product' })
  @ApiParam({ name: 'productId', description: 'Product UUID.' })
  @ApiOkResponse({ type: VariantResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  findAll(
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<VariantResponseDto[]> {
    return this.variantService.findAll(productId);
  }

  /**
   * Retrieves one variant.
   *
   * GET /admin/products/:productId/variants/:variantId
   *
   * @param productId Product UUID.
   * @param variantId Variant UUID.
   * @returns The variant.
   */
  @Get(':variantId')
  @ApiOperation({ summary: 'Get a variant' })
  @ApiParam({ name: 'productId', description: 'Product UUID.' })
  @ApiParam({ name: 'variantId', description: 'Variant UUID.' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiNotFoundResponse({ description: 'Product or variant not found.' })
  findOne(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
  ): Promise<VariantResponseDto> {
    return this.variantService.findOne(productId, variantId);
  }

  /**
   * Updates the sku, price override or active flag of a variant.
   *
   * PATCH /admin/products/:productId/variants/:variantId
   *
   * @param productId Product UUID.
   * @param variantId Variant UUID.
   * @param dto Fields to update.
   * @returns The updated variant.
   */
  @Patch(':variantId')
  @ApiOperation({
    summary: 'Update a variant',
    description:
      'Updates sku, price (null = use the product price) or isActive. Color, size and stock cannot be changed here.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID.' })
  @ApiParam({ name: 'variantId', description: 'Variant UUID.' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid input data, or a non-nullable field is null.',
  })
  @ApiNotFoundResponse({ description: 'Product or variant not found.' })
  @ApiConflictResponse({
    description: 'The sku already exists, or the product is deleted.',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'The last active variant of an ACTIVE product cannot be deactivated.',
  })
  update(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body() dto: UpdateVariantDto,
  ): Promise<VariantResponseDto> {
    return this.variantService.update(productId, variantId, dto);
  }

  /**
   * Sets the stock of a variant to an absolute value.
   *
   * PUT /admin/products/:productId/variants/:variantId/stock
   *
   * @param productId Product UUID.
   * @param variantId Variant UUID.
   * @param dto New stock quantity.
   * @returns The updated variant.
   */
  @Put(':variantId/stock')
  @ApiOperation({ summary: 'Set the stock of a variant' })
  @ApiParam({ name: 'productId', description: 'Product UUID.' })
  @ApiParam({ name: 'variantId', description: 'Variant UUID.' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid stock quantity.' })
  @ApiNotFoundResponse({ description: 'Variant not found.' })
  @ApiConflictResponse({ description: 'The product is deleted.' })
  setStock(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body() dto: SetStockDto,
  ): Promise<VariantResponseDto> {
    return this.stockService.setStock(productId, variantId, dto);
  }

  /**
   * Changes the stock of a variant by a delta.
   *
   * PATCH /admin/products/:productId/variants/:variantId/stock/adjust
   *
   * @param productId Product UUID.
   * @param variantId Variant UUID.
   * @param dto Delta to apply.
   * @returns The updated variant.
   */
  @Patch(':variantId/stock/adjust')
  @ApiOperation({
    summary: 'Adjust the stock of a variant by a delta',
    description:
      'A positive delta adds units and a negative delta removes units. The stock can never become negative.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID.' })
  @ApiParam({ name: 'variantId', description: 'Variant UUID.' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid delta (0 is not allowed).' })
  @ApiNotFoundResponse({ description: 'Variant not found.' })
  @ApiConflictResponse({ description: 'The product is deleted.' })
  @ApiUnprocessableEntityResponse({
    description: 'The result would be negative or above the maximum.',
  })
  adjustStock(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
    @Body() dto: AdjustStockDto,
  ): Promise<VariantResponseDto> {
    return this.stockService.adjustStock(productId, variantId, dto);
  }
}
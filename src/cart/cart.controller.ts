import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CartService } from './cart.service';
import { CurrentUserId } from './decorators/current-user-id.decorator';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

/**
 * Cart endpoints for the authenticated user.
 *
 * Every route works only on the cart of the user in the access token, so
 * a user can never read or change another user's cart. Every write
 * returns the updated cart.
 */
@ApiTags('Cart')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  /**
   * Injects the cart service.
   *
   * @param cartService Cart business logic.
   */
  constructor(private readonly cartService: CartService) {}

  /**
   * Returns the user's cart with availability and totals.
   *
   * @param userId Authenticated user id.
   * @returns The cart.
   */
  @Get()
  @ApiOperation({ summary: 'Get my cart' })
  @ApiOkResponse({ type: CartResponseDto })
  getCart(@CurrentUserId() userId: string): Promise<CartResponseDto> {
    return this.cartService.getCart(userId);
  }

  /**
   * Adds a variant to the cart, or increases its quantity.
   *
   * @param userId Authenticated user id.
   * @param dto Variant and quantity.
   * @returns The updated cart.
   */
  @Post('items')
  @ApiOperation({ summary: 'Add a variant to my cart' })
  @ApiCreatedResponse({ type: CartResponseDto })
  @ApiNotFoundResponse({ description: 'The variant does not exist.' })
  @ApiUnprocessableEntityResponse({
    description: 'The item is not available, or a cart limit is exceeded.',
  })
  @ApiConflictResponse({ description: 'Not enough stock.' })
  addItem(
    @CurrentUserId() userId: string,
    @Body() dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.addItem(userId, dto);
  }

  /**
   * Sets the quantity of a cart item.
   *
   * @param userId Authenticated user id.
   * @param itemId Cart item UUID.
   * @param dto New quantity.
   * @returns The updated cart.
   */
  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Change the quantity of a cart item' })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiNotFoundResponse({ description: 'The item is not in my cart.' })
  @ApiUnprocessableEntityResponse({
    description: 'The item is not available anymore. Remove it instead.',
  })
  @ApiConflictResponse({ description: 'Not enough stock.' })
  updateItem(
    @CurrentUserId() userId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.cartService.updateItem(userId, itemId, dto);
  }

  /**
   * Removes an item from the cart.
   *
   * @param userId Authenticated user id.
   * @param itemId Cart item UUID.
   * @returns The updated cart.
   */
  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove an item from my cart' })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiNotFoundResponse({ description: 'The item is not in my cart.' })
  removeItem(
    @CurrentUserId() userId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<CartResponseDto> {
    return this.cartService.removeItem(userId, itemId);
  }

  /**
   * Empties the cart.
   *
   * @param userId Authenticated user id.
   * @returns The empty cart.
   */
  @Delete()
  @ApiOperation({ summary: 'Empty my cart' })
  @ApiOkResponse({ type: CartResponseDto })
  clear(@CurrentUserId() userId: string): Promise<CartResponseDto> {
    return this.cartService.clear(userId);
  }
}
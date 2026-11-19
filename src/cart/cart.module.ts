import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductsModule } from '../products/products.module';
import { CartCheckoutService } from './cart-checkout.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartItem } from './entities/cart-item.entity';
import { Cart } from './entities/cart.entity';

/**
 * Cart module.
 *
 * Imports ProductsModule for the storage provider used to build image
 * URLs. CartService and CartCheckoutService are exported so the Orders
 * module can read and clear the cart at checkout.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem]), ProductsModule],
  controllers: [CartController],
  providers: [CartService, CartCheckoutService],
  exports: [CartService, CartCheckoutService],
})
export class CartModule {}
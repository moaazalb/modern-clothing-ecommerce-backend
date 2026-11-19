import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CartModule } from '../cart/cart.module';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { OrdersController } from './controllers/orders.controller';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import { AdminOrdersService } from './services/admin-orders.service';
import { OrderReadService } from './services/order-read.service';
import { OrderStateService } from './services/order-state.service';
import { OrdersService } from './services/orders.service';

/**
 * Orders module.
 *
 * Imports CartModule for the cart access used inside the checkout
 * transaction. Registers the order entities (required because the app
 * uses autoLoadEntities). Exports the status machine and the read service
 * for the Payments module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderStatusHistory]),
    CartModule,
  ],
  controllers: [OrdersController, AdminOrdersController],
  providers: [
    AdminOrdersService,
    OrderReadService,
    OrderStateService,
    OrdersService,
  ],
  exports: [OrderStateService, OrderReadService],
})
export class OrdersModule {}
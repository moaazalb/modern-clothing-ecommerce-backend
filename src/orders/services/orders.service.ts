import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

import {
  CartCheckoutService,
  CheckoutCartLine,
} from '../../cart/cart-checkout.service';
import { CartItemIssue } from '../../cart/enums/cart-item-issue.enum';
import { extractRows } from '../../common/utils/extract-rows.util';
import { fail } from '../../common/utils/http-error.util';
import {
  fromCents,
  isMoney,
  STORE_CURRENCY,
  toCents,
} from '../../common/utils/money.util';
import {
  BUYABLE_CONDITION_SQL,
  BUYABLE_JOINS_SQL,
} from '../../products/sql/buyability.sql';
import { User } from '../../users/entities/user.entity';
import {
  DEFAULT_SHIPPING_FEE,
  IDEMPOTENCY_KEY_REGEX,
  MAX_OPEN_ORDERS_PER_USER,
  ORDER_NUMBER_MAX_ATTEMPTS,
} from '../constants/order.constants';
import { CancelOrderDto } from '../dto/cancel-order.dto';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderDetailDto } from '../dto/order-response.dto';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { generateOrderNumber } from '../utils/order-number.util';
import { OrderReadService } from './order-read.service';
import { OrderStateService } from './order-state.service';

/**
 * Atomic stock deduction for one variant.
 *
 * One statement checks and changes the stock: it matches no row when the
 * variant is not buyable or the stock is not enough. Row locking makes the
 * stock check use the latest committed value, so the last unit can never
 * be sold twice. The prices are read in the same statement.
 */
const DEDUCT_STOCK_SQL = `
  UPDATE "product_variants" AS uv
  SET "stockQuantity" = uv."stockQuantity" - $2, "updatedAt" = now()
  WHERE uv."id" = $1
    AND uv."stockQuantity" >= $2
    AND EXISTS (
      SELECT 1 FROM "product_variants" v ${BUYABLE_JOINS_SQL}
      WHERE v."id" = uv."id" AND ${BUYABLE_CONDITION_SQL}
    )
  RETURNING uv."price" AS "variantPrice",
            (SELECT p2."price" FROM "products" p2
             WHERE p2."id" = uv."productId") AS "productPrice"`;

/**
 * Names and options of variants, copied into the order lines.
 */
const SNAPSHOT_SQL = `
  SELECT v."id" AS "variantId", v."sku" AS "sku", p."name" AS "productName",
         vc."name" AS "colorName", vs."name" AS "sizeName",
         vs."code" AS "sizeCode"
  FROM "product_variants" v ${BUYABLE_JOINS_SQL}
  WHERE v."id" = ANY($1::uuid[])`;

/**
 * State of variants that could not be ordered, to explain why.
 */
const UNAVAILABLE_SQL = `
  SELECT v."id" AS "variantId", v."sku" AS "sku", p."name" AS "productName",
         v."stockQuantity" AS "stock",
         COALESCE(${BUYABLE_CONDITION_SQL}, false) AS "buyable"
  FROM "product_variants" v ${BUYABLE_JOINS_SQL}
  WHERE v."id" = ANY($1::uuid[])`;

/**
 * Order insert. A collision on the random order number inserts nothing, so
 * the caller can try another number without aborting the transaction.
 */
const INSERT_ORDER_SQL = `
  INSERT INTO "orders" (
    "orderNumber", "userId", "currency", "subtotal", "shippingFee", "total",
    "customerEmail", "shippingName", "shippingPhone", "shippingCountry",
    "shippingCity", "shippingAddress", "shippingNotes", "customerNote",
    "paymentMethod", "idempotencyKey"
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
  )
  ON CONFLICT ("orderNumber") DO NOTHING
  RETURNING "id"`;

/**
 * A cart line after its stock was deducted.
 */
interface DeductedLine {
  variantId: string;
  quantity: number;
  variantPrice: string | null;
  productPrice: string;
}

/**
 * Names and options of a variant at purchase time.
 */
interface VariantSnapshot {
  variantId: string;
  sku: string;
  productName: string;
  colorName: string;
  sizeName: string | null;
  sizeCode: string | null;
}

/**
 * State of a variant that could not be ordered.
 */
interface UnavailableRow {
  variantId: string;
  sku: string;
  productName: string;
  stock: number;
  buyable: boolean;
}

/**
 * An order line ready to be inserted.
 */
interface PricedLine {
  variantId: string;
  productName: string;
  sku: string;
  colorName: string;
  sizeName: string | null;
  sizeCode: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

/**
 * Orders service (customer operations): checkout and cancellation.
 *
 * Checkout is one transaction: it locks the user's cart, deducts the stock
 * of every line atomically, freezes names and prices into the order, and
 * empties the cart. If any line cannot be ordered the whole transaction
 * rolls back, so the stock is exactly as it was.
 */
@Injectable()
export class OrdersService {
  private readonly shippingFee: string;

  /**
   * Injects the services this class relies on and reads the shipping fee.
   *
   * @param dataSource TypeORM data source used to open transactions.
   * @param configService Provides SHIPPING_FEE_USD.
   * @param cartCheckout Cart access inside the checkout transaction.
   * @param orderState Order status machine.
   * @param readService Order read operations.
   * @throws Error If SHIPPING_FEE_USD is not a valid amount.
   */
  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
    private readonly cartCheckout: CartCheckoutService,
    private readonly orderState: OrderStateService,
    private readonly readService: OrderReadService,
  ) {
    const configured =
      configService.get<string>('SHIPPING_FEE_USD') ?? DEFAULT_SHIPPING_FEE;

    if (!isMoney(configured)) {
      throw new Error(
        'SHIPPING_FEE_USD must be a decimal amount such as "5.00".',
      );
    }

    this.shippingFee = fromCents(toCents(configured));
  }

  /**
   * Deducts the stock of every cart line, one atomic statement per line,
   * in the order of the lines (sorted by variant id). Failures are
   * collected so the customer sees every problem at once.
   *
   * @param manager Entity manager of the running transaction.
   * @param lines Cart lines.
   * @returns The deducted lines with their prices.
   * @throws HttpException 409 CHECKOUT_ITEMS_UNAVAILABLE if any line cannot be ordered.
   */
  private async deductStock(
    manager: EntityManager,
    lines: CheckoutCartLine[],
  ): Promise<DeductedLine[]> {
    const deducted: DeductedLine[] = [];
    const failed: CheckoutCartLine[] = [];

    for (const line of lines) {
      const result: unknown = await manager.query(DEDUCT_STOCK_SQL, [
        line.variantId,
        line.quantity,
      ]);

      const rows = extractRows<{
        variantPrice: string | null;
        productPrice: string;
      }>(result);

      if (rows.length === 0) {
        failed.push(line);
      } else {
        deducted.push({
          variantId: line.variantId,
          quantity: line.quantity,
          variantPrice: rows[0].variantPrice,
          productPrice: rows[0].productPrice,
        });
      }
    }

    if (failed.length > 0) {
      await this.throwUnavailable(manager, failed);
    }

    return deducted;
  }

  /**
   * Explains why lines could not be ordered and throws the error.
   *
   * @param manager Entity manager of the running transaction.
   * @param failed The lines that could not be ordered.
   * @throws HttpException 409 CHECKOUT_ITEMS_UNAVAILABLE with the details of each line.
   */
  private async throwUnavailable(
    manager: EntityManager,
    failed: CheckoutCartLine[],
  ): Promise<never> {
    const rows: UnavailableRow[] = await manager.query(UNAVAILABLE_SQL, [
      failed.map((line) => line.variantId),
    ]);

    const byId = new Map(rows.map((row) => [row.variantId, row]));

    const items = failed.map((line) => {
      const row = byId.get(line.variantId);
      const stock = Math.max(Number(row?.stock ?? 0), 0);

      let issue = CartItemIssue.UNAVAILABLE;
      let available = 0;

      if (row?.buyable && stock < line.quantity) {
        issue =
          stock === 0
            ? CartItemIssue.OUT_OF_STOCK
            : CartItemIssue.INSUFFICIENT_STOCK;
        available = stock;
      }

      return {
        variantId: line.variantId,
        productName: row?.productName ?? null,
        sku: row?.sku ?? null,
        issue,
        available,
      };
    });

    return fail(
      HttpStatus.CONFLICT,
      'CHECKOUT_ITEMS_UNAVAILABLE',
      'Some items in your cart cannot be ordered. Review your cart and try again.',
      { items },
    );
  }

  /**
   * Loads the names and options of the variants being ordered.
   *
   * @param manager Entity manager of the running transaction.
   * @param variantIds Variant UUIDs.
   * @returns The snapshots by variant id.
   */
  private async loadSnapshots(
    manager: EntityManager,
    variantIds: string[],
  ): Promise<Map<string, VariantSnapshot>> {
    const rows: VariantSnapshot[] = await manager.query(SNAPSHOT_SQL, [
      variantIds,
    ]);

    return new Map(rows.map((row) => [row.variantId, row]));
  }

  /**
   * Computes the price of every line in integer cents.
   * The unit price is the variant price, or the product price when the
   * variant has none.
   *
   * @param deducted Deducted cart lines.
   * @param snapshots Names and options by variant id.
   * @returns The priced lines and their sum in cents.
   * @throws InternalServerErrorException If a snapshot is missing.
   */
  private priceLines(
    deducted: DeductedLine[],
    snapshots: Map<string, VariantSnapshot>,
  ): { lines: PricedLine[]; subtotalCents: number } {
    let subtotalCents = 0;

    const lines = deducted.map((line): PricedLine => {
      const snapshot = snapshots.get(line.variantId);

      if (!snapshot) {
        throw new InternalServerErrorException(
          'A purchased variant could not be read.',
        );
      }

      const unitPrice = fromCents(toCents(line.variantPrice ?? line.productPrice));
      const lineCents = toCents(unitPrice) * line.quantity;
      subtotalCents += lineCents;

      return {
        variantId: line.variantId,
        productName: snapshot.productName,
        sku: snapshot.sku,
        colorName: snapshot.colorName,
        sizeName: snapshot.sizeName,
        sizeCode: snapshot.sizeCode,
        unitPrice,
        quantity: line.quantity,
        lineTotal: fromCents(lineCents),
      };
    });

    return { lines, subtotalCents };
  }

  /**
   * Inserts the order row, trying another random number on a collision.
   *
   * @param manager Entity manager of the running transaction.
   * @param values The values of the order (everything but the number).
   * @returns The new order id.
   * @throws InternalServerErrorException If no free order number was found.
   */
  private async insertOrder(
    manager: EntityManager,
    values: unknown[],
  ): Promise<string> {
    for (let attempt = 0; attempt < ORDER_NUMBER_MAX_ATTEMPTS; attempt += 1) {
      const result: unknown = await manager.query(INSERT_ORDER_SQL, [
        generateOrderNumber(),
        ...values,
      ]);

      const id = extractRows<{ id: string }>(result)[0]?.id;

      if (id) {
        return id;
      }
    }

    throw new InternalServerErrorException(
      'Could not generate a unique order number. Please try again.',
    );
  }

  /**
   * Places an order from the user's cart.
   *
   * Repeating a request with the same Idempotency-Key returns the order
   * that the first request created, without creating another one or
   * touching the stock again.
   *
   * @param userId Customer UUID.
   * @param idempotencyKey Value of the Idempotency-Key header.
   * @param dto Delivery details and options.
   * @returns The created order.
   * @throws HttpException 400 IDEMPOTENCY_KEY_REQUIRED, 422 CART_EMPTY or TOO_MANY_OPEN_ORDERS, 409 CHECKOUT_ITEMS_UNAVAILABLE.
   */
  async checkout(
    userId: string,
    idempotencyKey: string | undefined,
    dto: CreateOrderDto,
  ): Promise<OrderDetailDto> {
    if (!idempotencyKey || !IDEMPOTENCY_KEY_REGEX.test(idempotencyKey)) {
      fail(
        HttpStatus.BAD_REQUEST,
        'IDEMPOTENCY_KEY_REQUIRED',
        'The Idempotency-Key header is required (16 to 64 letters, digits, "_" or "-").',
      );
    }

    const orderId = await this.dataSource.transaction(async (manager) => {
      const cart = await this.cartCheckout.lockCart(manager, userId);

      const existing = await manager.findOne(Order, {
        where: { userId, idempotencyKey },
        select: { id: true },
      });

      if (existing) {
        return existing.id;
      }

      if (!cart || cart.lines.length === 0) {
        fail(HttpStatus.UNPROCESSABLE_ENTITY, 'CART_EMPTY', 'The cart is empty.');
      }

      const openOrders = await manager.count(Order, {
        where: { userId, status: OrderStatus.PENDING },
      });

      if (openOrders >= MAX_OPEN_ORDERS_PER_USER) {
        fail(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'TOO_MANY_OPEN_ORDERS',
          `You can have at most ${MAX_OPEN_ORDERS_PER_USER} pending orders. Wait for them to be processed or cancel one.`,
        );
      }

      const user = await manager.findOne(User, {
        where: { id: userId },
        select: { id: true, email: true },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid authentication token.');
      }

      const deducted = await this.deductStock(manager, cart.lines);
      const snapshots = await this.loadSnapshots(
        manager,
        deducted.map((line) => line.variantId),
      );
      const { lines, subtotalCents } = this.priceLines(deducted, snapshots);

      const shippingCents = toCents(this.shippingFee);

      const id = await this.insertOrder(manager, [
        userId,
        STORE_CURRENCY,
        fromCents(subtotalCents),
        this.shippingFee,
        fromCents(subtotalCents + shippingCents),
        user.email,
        dto.shippingName,
        dto.shippingPhone,
        dto.shippingCountry,
        dto.shippingCity,
        dto.shippingAddress,
        dto.shippingNotes ?? null,
        dto.customerNote ?? null,
        dto.paymentMethod ?? PaymentMethod.COD,
        idempotencyKey,
      ]);

      await manager.insert(
        OrderItem,
        lines.map((line) => ({ orderId: id, ...line })),
      );

      await manager.insert(OrderStatusHistory, {
        orderId: id,
        fromStatus: null,
        toStatus: OrderStatus.PENDING,
        changedByUserId: null,
        note: null,
      });

      await this.cartCheckout.clear(manager, cart.cartId);

      return id;
    });

    return this.readService.findDetailForCustomer(userId, orderId);
  }

  /**
   * Cancels one of the customer's own orders (only while PENDING) and puts
   * the stock back. Cancelling an already cancelled order changes nothing.
   *
   * @param userId Customer UUID.
   * @param orderId Order UUID.
   * @param dto Optional reason.
   * @returns The order after the change.
   * @throws NotFoundException If the order does not exist or is not the user's.
   * @throws HttpException 409 INVALID_STATUS_TRANSITION if the order is not PENDING.
   */
  async cancel(
    userId: string,
    orderId: string,
    dto: CancelOrderDto,
  ): Promise<OrderDetailDto> {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.orderState.lockOrder(manager, orderId, userId);

      await this.orderState.transition(
        manager,
        order,
        OrderStatus.CANCELLED,
        { userId, isAdmin: false },
        { reason: dto.reason },
      );
    });

    return this.readService.findDetailForCustomer(userId, orderId);
  }
}
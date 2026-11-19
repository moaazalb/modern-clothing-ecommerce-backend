import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import {
  fromCents,
  STORE_CURRENCY,
  toCents,
} from '../common/utils/money.util';
import { PublicColorDto } from '../products/dto/catalog/color/public-color.dto';
import { PublicSizeDto } from '../products/dto/catalog/size/public-size.dto';
import { StorageProvider } from '../products/storage/storage.provider';
import {
  CART_MAX_ITEM_QUANTITY,
  CART_MAX_LINES,
} from './constants/cart.constants';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartItemDto, CartResponseDto } from './dto/cart-response.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartItem } from './entities/cart-item.entity';
import { CartItemIssue } from './enums/cart-item-issue.enum';

/**
 * Human-readable HTTP error names used in the response body.
 */
const ERROR_NAMES: Readonly<Record<number, string>> = {
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
};

/**
 * Throws an HTTP error with the same body shape as PostgresExceptionFilter:
 * { statusCode, error, code, message }.
 *
 * @param status HTTP status.
 * @param code Machine-readable error code.
 * @param message Human-readable message.
 */
function fail(status: HttpStatus, code: string, message: string): never {
  throw new HttpException(
    { statusCode: status, error: ERROR_NAMES[status] ?? 'Error', code, message },
    status,
  );
}

/**
 * Categories that are effectively active: built from the active roots
 * downwards, so a category under an inactive parent is never reached.
 * Mirrors the rule of the public product search.
 */
const ACTIVE_CATEGORY_IDS_SQL = `
  WITH RECURSIVE "active_tree" AS (
    SELECT "id", 1 AS "level" FROM "categories"
    WHERE "parentId" IS NULL AND "isActive" = true
    UNION ALL
    SELECT c."id", t."level" + 1 FROM "categories" c
    JOIN "active_tree" t ON c."parentId" = t."id"
    WHERE c."isActive" = true AND t."level" < 50
  )
  SELECT "id" FROM "active_tree"`;

/**
 * Joins used after "product_variants v" to evaluate buyability.
 */
const PRODUCT_JOINS_SQL = `
  JOIN "products" p ON p."id" = v."productId"
  JOIN "colors" vc ON vc."id" = v."colorId"
  LEFT JOIN "sizes" vs ON vs."id" = v."sizeId"
  LEFT JOIN "brands" vb ON vb."id" = p."brandId"`;

/**
 * True when a variant can be shown and bought: ACTIVE and not deleted
 * product, effectively active category, active brand, color and size, and
 * an active variant. Same rules as the public storefront.
 */
const BUYABLE_SQL = `COALESCE(
  v."isActive" = true
  AND vc."isActive" = true
  AND (v."sizeId" IS NULL OR vs."isActive" = true)
  AND p."status" = 'ACTIVE'
  AND p."deletedAt" IS NULL
  AND (p."brandId" IS NULL OR vb."isActive" = true)
  AND p."categoryId" IN (${ACTIVE_CATEGORY_IDS_SQL}),
  false)`;

/**
 * A cart line joined with everything needed to display it.
 */
interface CartItemRow {
  itemId: string;
  variantId: string;
  quantity: number;
  sku: string;
  variantPrice: string | null;
  stockQuantity: number;
  productId: string;
  productName: string;
  productSlug: string;
  productPrice: string;
  colorId: string;
  colorName: string;
  colorSlug: string;
  hexCode: string;
  sizeId: string | null;
  sizeName: string | null;
  sizeCode: string | null;
  sizeType: PublicSizeDto['sizeType'] | null;
  sizeSortOrder: number | null;
  buyable: boolean;
}

/**
 * Buyability and stock of one variant.
 */
interface VariantState {
  buyable: boolean;
  stockQuantity: number;
}

/**
 * Shopping cart service (customer operations).
 *
 * Stock is checked but never reserved: the atomic deduction happens at
 * checkout. Prices are never stored, they are read from the variant (or
 * product) every time. Nothing is removed silently: lines that stop being
 * buyable are shown with an issue and left out of the totals.
 *
 * Every write takes a row lock on the user's cart (the upsert itself locks
 * it), so two concurrent requests of the same user are serialized and can
 * neither duplicate a line nor exceed the limits.
 */
@Injectable()
export class CartService {
  /**
   * Injects the data source and the storage provider (for image URLs).
   *
   * @param dataSource TypeORM data source.
   * @param storage Storage provider used to build image URLs.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: StorageProvider,
  ) {}

  /**
   * Creates the user's cart when it does not exist, and locks its row for
   * the rest of the transaction.
   *
   * @param manager Entity manager of the running transaction.
   * @param userId User UUID.
   * @returns The cart id.
   */
  private async lockOrCreateCart(
    manager: EntityManager,
    userId: string,
  ): Promise<string> {
    const result: unknown = await manager.query(
      `INSERT INTO "carts" ("userId") VALUES ($1)
       ON CONFLICT ("userId") DO UPDATE SET "updatedAt" = now()
       RETURNING "id"`,
      [userId],
    );

    const rows = (
      Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result
    ) as { id: string }[];

    return rows[0].id;
  }

  /**
   * Locks the user's existing cart for the rest of the transaction.
   *
   * @param manager Entity manager of the running transaction.
   * @param userId User UUID.
   * @returns The cart id, or null when the user has no cart.
   */
  private async lockExistingCart(
    manager: EntityManager,
    userId: string,
  ): Promise<string | null> {
    const rows: { id: string }[] = await manager.query(
      `SELECT "id" FROM "carts" WHERE "userId" = $1 FOR UPDATE`,
      [userId],
    );

    return rows[0]?.id ?? null;
  }

  /**
   * Reads the buyability and stock of a variant.
   *
   * @param manager Entity manager of the running transaction.
   * @param variantId Variant UUID.
   * @returns The state, or null when the variant does not exist.
   */
  private async loadVariantState(
    manager: EntityManager,
    variantId: string,
  ): Promise<VariantState | null> {
    const rows: VariantState[] = await manager.query(
      `SELECT ${BUYABLE_SQL} AS "buyable", v."stockQuantity" AS "stockQuantity"
       FROM "product_variants" v ${PRODUCT_JOINS_SQL}
       WHERE v."id" = $1`,
      [variantId],
    );

    return rows[0] ?? null;
  }

  /**
   * Checks that a variant can be bought in the requested quantity.
   *
   * @param state Current state of the variant.
   * @param quantity Wanted quantity.
   * @throws HttpException 422 if the variant is not buyable, 409 if the stock is not enough.
   */
  private assertCanHold(state: VariantState, quantity: number): void {
    if (!state.buyable) {
      fail(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ITEM_UNAVAILABLE',
        'This item is not available.',
      );
    }

    if (state.stockQuantity < quantity) {
      fail(
        HttpStatus.CONFLICT,
        'INSUFFICIENT_STOCK',
        state.stockQuantity === 0
          ? 'This item is out of stock.'
          : `Only ${state.stockQuantity} unit(s) available.`,
      );
    }
  }

  /**
   * Builds the cart view: lines, availability and totals.
   *
   * @param manager Entity manager to read with.
   * @param cartId Cart UUID, or null for an empty cart.
   * @returns The cart view.
   */
  private async buildView(
    manager: EntityManager,
    cartId: string | null,
  ): Promise<CartResponseDto> {
    const rows: CartItemRow[] = cartId
      ? await manager.query(
          `SELECT ci."id" AS "itemId", ci."variantId" AS "variantId",
                  ci."quantity" AS "quantity",
                  v."sku" AS "sku", v."price" AS "variantPrice",
                  v."stockQuantity" AS "stockQuantity",
                  p."id" AS "productId", p."name" AS "productName",
                  p."slug" AS "productSlug", p."price" AS "productPrice",
                  vc."id" AS "colorId", vc."name" AS "colorName",
                  vc."slug" AS "colorSlug", vc."hexCode" AS "hexCode",
                  vs."id" AS "sizeId", vs."name" AS "sizeName",
                  vs."code" AS "sizeCode", vs."sizeType" AS "sizeType",
                  vs."sortOrder" AS "sizeSortOrder",
                  ${BUYABLE_SQL} AS "buyable"
           FROM "cart_items" ci
           JOIN "product_variants" v ON v."id" = ci."variantId"
           ${PRODUCT_JOINS_SQL}
           WHERE ci."cartId" = $1
           ORDER BY ci."createdAt" ASC, ci."id" ASC`,
          [cartId],
        )
      : [];

    const productIds = [...new Set(rows.map((row) => row.productId))];

    const images: {
      productId: string;
      colorId: string | null;
      storageKey: string;
    }[] =
      productIds.length > 0
        ? await manager.query(
            `SELECT "productId", "colorId", "storageKey"
             FROM "product_images"
             WHERE "productId" = ANY($1::uuid[]) AND "sortOrder" = 0`,
            [productIds],
          )
        : [];

    const imageKeyByGroup = new Map(
      images.map((image) => [
        `${image.productId}:${image.colorId ?? ''}`,
        image.storageKey,
      ]),
    );

    let subtotalCents = 0;
    let itemCount = 0;
    let hasUnavailableItems = false;

    const items = rows.map((row): CartItemDto => {
      let issue: CartItemIssue | null = null;

      if (!row.buyable) {
        issue = CartItemIssue.UNAVAILABLE;
      } else if (row.stockQuantity <= 0) {
        issue = CartItemIssue.OUT_OF_STOCK;
      } else if (row.stockQuantity < row.quantity) {
        issue = CartItemIssue.INSUFFICIENT_STOCK;
      }

      const unitPrice = row.variantPrice ?? row.productPrice;
      const lineCents = toCents(unitPrice) * row.quantity;

      if (issue === null) {
        subtotalCents += lineCents;
        itemCount += row.quantity;
      } else {
        hasUnavailableItems = true;
      }

      const color: PublicColorDto = {
        id: row.colorId,
        name: row.colorName,
        slug: row.colorSlug,
        hexCode: row.hexCode,
      };

      const size: PublicSizeDto | null =
        row.sizeId && row.sizeName && row.sizeCode && row.sizeType
          ? {
              id: row.sizeId,
              name: row.sizeName,
              code: row.sizeCode,
              sizeType: row.sizeType,
              sortOrder: row.sizeSortOrder ?? 0,
            }
          : null;

      const imageKey =
        imageKeyByGroup.get(`${row.productId}:${row.colorId}`) ??
        imageKeyByGroup.get(`${row.productId}:`);

      const canShowMax =
        issue === null || issue === CartItemIssue.INSUFFICIENT_STOCK;

      return {
        id: row.itemId,
        variantId: row.variantId,
        productId: row.productId,
        productName: row.productName,
        productSlug: row.productSlug,
        sku: row.sku,
        color,
        size,
        imageUrl: imageKey ? this.storage.getPublicUrl(imageKey) : null,
        quantity: row.quantity,
        unitPrice: fromCents(toCents(unitPrice)),
        lineTotal: fromCents(lineCents),
        available: issue === null,
        issue,
        maxQuantity: canShowMax
          ? Math.min(row.stockQuantity, CART_MAX_ITEM_QUANTITY)
          : 0,
      };
    });

    return {
      items,
      itemCount,
      subtotal: fromCents(subtotalCents),
      currency: STORE_CURRENCY,
      hasUnavailableItems,
    };
  }

  /**
   * Returns the user's cart. A user without a cart gets an empty one
   * (nothing is created by reading).
   *
   * @param userId User UUID.
   * @returns The cart view.
   */
  async getCart(userId: string): Promise<CartResponseDto> {
    const manager = this.dataSource.manager;

    const rows: { id: string }[] = await manager.query(
      `SELECT "id" FROM "carts" WHERE "userId" = $1`,
      [userId],
    );

    return this.buildView(manager, rows[0]?.id ?? null);
  }

  /**
   * Adds a variant to the cart, or increases its quantity when it is
   * already there.
   *
   * @param userId User UUID.
   * @param dto Variant and quantity to add.
   * @returns The updated cart view.
   * @throws NotFoundException If the variant does not exist.
   * @throws HttpException 422 if the variant is not buyable or a cart limit is exceeded, 409 if the stock is not enough.
   */
  async addItem(
    userId: string,
    dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const cartId = await this.lockOrCreateCart(manager, userId);

      const state = await this.loadVariantState(manager, dto.variantId);

      if (!state) {
        throw new NotFoundException(
          `Variant with ID ${dto.variantId} was not found.`,
        );
      }

      if (!state.buyable) {
        fail(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'ITEM_UNAVAILABLE',
          'This item is not available.',
        );
      }

      const existing = await manager.findOne(CartItem, {
        where: { cartId, variantId: dto.variantId },
      });

      if (!existing) {
        const lines = await manager.count(CartItem, { where: { cartId } });

        if (lines >= CART_MAX_LINES) {
          fail(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'CART_LINE_LIMIT',
            `The cart cannot have more than ${CART_MAX_LINES} different items.`,
          );
        }
      }

      const quantity = (existing?.quantity ?? 0) + dto.quantity;

      if (quantity > CART_MAX_ITEM_QUANTITY) {
        fail(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'ITEM_QUANTITY_LIMIT',
          `You can have at most ${CART_MAX_ITEM_QUANTITY} units of the same item in the cart.`,
        );
      }

      this.assertCanHold(state, quantity);

      if (existing) {
        await manager.update(CartItem, { id: existing.id }, { quantity });
      } else {
        await manager.insert(CartItem, {
          cartId,
          variantId: dto.variantId,
          quantity,
        });
      }

      return this.buildView(manager, cartId);
    });
  }

  /**
   * Sets the quantity of a cart item. The item must belong to the user's cart.
   *
   * @param userId User UUID.
   * @param itemId Cart item UUID.
   * @param dto New quantity.
   * @returns The updated cart view.
   * @throws NotFoundException If the item is not in the user's cart.
   * @throws HttpException 422 if the variant is no longer buyable (remove it instead), 409 if the stock is not enough.
   */
  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const cartId = await this.lockExistingCart(manager, userId);

      const item = cartId
        ? await manager.findOne(CartItem, { where: { id: itemId, cartId } })
        : null;

      if (!cartId || !item) {
        throw new NotFoundException(`Cart item with ID ${itemId} was not found.`);
      }

      const state = await this.loadVariantState(manager, item.variantId);

      if (!state) {
        throw new NotFoundException(`Cart item with ID ${itemId} was not found.`);
      }

      this.assertCanHold(state, dto.quantity);

      await manager.update(
        CartItem,
        { id: item.id },
        { quantity: dto.quantity },
      );

      return this.buildView(manager, cartId);
    });
  }

  /**
   * Removes an item from the user's cart.
   *
   * @param userId User UUID.
   * @param itemId Cart item UUID.
   * @returns The updated cart view.
   * @throws NotFoundException If the item is not in the user's cart.
   */
  async removeItem(userId: string, itemId: string): Promise<CartResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const cartId = await this.lockExistingCart(manager, userId);

      if (!cartId) {
        throw new NotFoundException(`Cart item with ID ${itemId} was not found.`);
      }

      const result = await manager
        .createQueryBuilder()
        .delete()
        .from(CartItem)
        .where('"id" = :itemId AND "cartId" = :cartId', { itemId, cartId })
        .execute();

      if (!result.affected) {
        throw new NotFoundException(`Cart item with ID ${itemId} was not found.`);
      }

      return this.buildView(manager, cartId);
    });
  }

  /**
   * Removes every item from the user's cart.
   *
   * @param userId User UUID.
   * @returns The empty cart view.
   */
  async clear(userId: string): Promise<CartResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const cartId = await this.lockExistingCart(manager, userId);

      if (cartId) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(CartItem)
          .where('"cartId" = :cartId', { cartId })
          .execute();
      }

      return this.buildView(manager, cartId);
    });
  }
}
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MAX_STOCK_QUANTITY } from '../../constants/product.constants';
import { AdjustStockDto } from '../../dto/variant/adjust-stock.dto';
import { SetStockDto } from '../../dto/variant/set-stock.dto';
import { VariantResponseDto } from '../../dto/variant/variant-response.dto';
import { ProductVariant } from '../../entities/product-variant.entity';
import { Product } from '../../entities/product.entity';
import { ProductVariantService } from '../product/product-variant.service';

/**
 * Stock service (admin operations).
 *
 * Every change is one atomic UPDATE statement, never a read followed by a
 * write, so concurrent changes cannot overwrite each other. The database
 * CHECK (stockQuantity >= 0) is the last line of defense.
 *
 * Deducting stock for customer orders belongs to the Orders module, which
 * must use the atomic statement described in the design document.
 */
@Injectable()
export class StockService {
  /**
   * Injects the variants repository and the variant service.
   *
   * @param variantsRepository TypeORM repository for ProductVariant entities.
   * @param variantService Used to return the updated variant.
   */
  constructor(
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    private readonly variantService: ProductVariantService,
  ) {}

  /**
   * Explains why an atomic stock update did not change any row.
   *
   * @param productId Product UUID.
   * @param variantId Variant UUID.
   * @param isAdjustment True for a delta adjustment, false for an absolute set.
   * @throws NotFoundException If the variant does not exist in the product.
   * @throws ConflictException If the product is deleted.
   * @throws UnprocessableEntityException If the adjustment would break the stock limits.
   */
  private async explainFailure(
    productId: string,
    variantId: string,
    isAdjustment: boolean,
  ): Promise<never> {
    const variant = await this.variantsRepository.findOne({
      where: { id: variantId, productId },
    });

    if (!variant) {
      throw new NotFoundException(
        `Variant with ID ${variantId} was not found in this product.`,
      );
    }

    const product = await this.variantsRepository.manager.findOne(Product, {
      where: { id: productId },
      withDeleted: true,
    });

    if (product?.deletedAt) {
      throw new ConflictException(
        'The product is deleted. Restore it before changing its stock.',
      );
    }

    throw new UnprocessableEntityException(
      isAdjustment
        ? `The adjustment would make the stock negative or higher than ${MAX_STOCK_QUANTITY}.`
        : 'The stock could not be updated.',
    );
  }

  /**
   * Sets the stock of a variant to an absolute value.
   *
   * @param productId Product UUID.
   * @param variantId Variant UUID.
   * @param dto New stock quantity.
   * @returns The updated variant.
   * @throws NotFoundException If the variant does not exist in the product.
   * @throws ConflictException If the product is deleted.
   */
  async setStock(
    productId: string,
    variantId: string,
    dto: SetStockDto,
  ): Promise<VariantResponseDto> {
    const result = await this.variantsRepository
      .createQueryBuilder()
      .update(ProductVariant)
      .set({ stockQuantity: dto.stockQuantity })
      .where('"id" = :variantId AND "productId" = :productId', {
        variantId,
        productId,
      })
      .andWhere(
        'EXISTS (SELECT 1 FROM "products" "p" WHERE "p"."id" = :productId AND "p"."deletedAt" IS NULL)',
      )
      .execute();

    if (!result.affected) {
      await this.explainFailure(productId, variantId, false);
    }

    return this.variantService.findOne(productId, variantId);
  }

  /**
   * Changes the stock of a variant by a delta (positive adds, negative removes).
   * The statement matches no row when the result would be negative or above
   * the maximum, so the stock can never go below zero.
   *
   * @param productId Product UUID.
   * @param variantId Variant UUID.
   * @param dto Delta to apply.
   * @returns The updated variant.
   * @throws NotFoundException If the variant does not exist in the product.
   * @throws ConflictException If the product is deleted.
   * @throws UnprocessableEntityException If the result would be negative or too high.
   */
  async adjustStock(
    productId: string,
    variantId: string,
    dto: AdjustStockDto,
  ): Promise<VariantResponseDto> {
    const result = await this.variantsRepository
      .createQueryBuilder()
      .update(ProductVariant)
      .set({ stockQuantity: () => '"stockQuantity" + :delta' })
      .where('"id" = :variantId AND "productId" = :productId', {
        variantId,
        productId,
      })
      .andWhere('"stockQuantity" + :delta BETWEEN 0 AND :maxStock')
      .andWhere(
        'EXISTS (SELECT 1 FROM "products" "p" WHERE "p"."id" = :productId AND "p"."deletedAt" IS NULL)',
      )
      .setParameters({ delta: dto.delta, maxStock: MAX_STOCK_QUANTITY })
      .execute();

    if (!result.affected) {
      await this.explainFailure(productId, variantId, true);
    }

    return this.variantService.findOne(productId, variantId);
  }
}
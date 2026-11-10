import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ProductSort } from '../../enums/product.enum';
import { AdminProductListQueryDto } from './admin-product-list-query.dto';
import { ProductListQueryDto } from './product-list-query.dto';

const UUID = '3f1c2b7e-8d4a-4c5b-9e6f-1a2b3c4d5e6f';

/**
 * Runs the same validation options as the global ValidationPipe.
 */
async function check<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
) {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { instance, errors };
}

describe('ProductListQueryDto', () => {
  it('accepts an empty query', async () => {
    expect((await check(ProductListQueryDto, {})).errors).toHaveLength(0);
  });

  it('accepts every whitelisted filter', async () => {
    const { instance, errors } = await check(ProductListQueryDto, {
      sort: ProductSort.PRICE_ASC,
      categoryId: UUID,
      brandId: UUID,
      tagId: UUID,
      colorId: UUID,
      sizeId: UUID,
      gender: 'MEN',
      minPrice: '10.00',
      maxPrice: '100',
      inStock: 'true',
      q: '  hoodie ',
    });
    expect(errors).toHaveLength(0);
    expect(instance.inStock).toBe(true);
    expect(instance.q).toBe('hoodie');
  });

  it('converts inStock "false" to false', async () => {
    const { instance, errors } = await check(ProductListQueryDto, {
      inStock: 'false',
    });
    expect(errors).toHaveLength(0);
    expect(instance.inStock).toBe(false);
  });

  it('rejects invalid values', async () => {
    for (const bad of [
      { sort: 'random' },
      { categoryId: 'x' },
      { gender: 'KIDS' },
      { minPrice: '-1' },
      { maxPrice: '1.234' },
      { inStock: 'yes' },
      { q: 'a'.repeat(101) },
    ]) {
      expect((await check(ProductListQueryDto, bad)).errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects admin-only and unknown parameters', async () => {
    for (const bad of [{ status: 'ACTIVE' }, { isFeatured: 'true' }, { foo: 1 }]) {
      expect((await check(ProductListQueryDto, bad)).errors.length).toBeGreaterThan(0);
    }
  });
});

describe('AdminProductListQueryDto', () => {
  it('accepts status and isFeatured on top of the public filters', async () => {
    const { instance, errors } = await check(AdminProductListQueryDto, {
      status: 'DRAFT',
      isFeatured: 'true',
      sort: ProductSort.NEWEST,
    });
    expect(errors).toHaveLength(0);
    expect(instance.isFeatured).toBe(true);
  });

  it('rejects an invalid status', async () => {
    expect(
      (await check(AdminProductListQueryDto, { status: 'DELETED' })).errors
        .length,
    ).toBeGreaterThan(0);
  });
});
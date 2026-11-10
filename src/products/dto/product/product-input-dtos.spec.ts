import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ProductGender, SizeType } from '../../enums/product.enum';
import { AddProductColorDto } from './add-product-color.dto';
import { AddProductSizeDto } from './add-product-size.dto';
import { CreateProductDto } from './create-product.dto';
import { SetProductTagsDto } from './set-product-tags.dto';
import { UpdateProductDto } from './update-product.dto';

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

const validCreate = {
  name: '  Classic Cotton Hoodie  ',
  price: '55.00',
  categoryId: UUID,
  gender: ProductGender.UNISEX,
};

describe('CreateProductDto', () => {
  it('accepts the minimal valid payload and trims the name', async () => {
    const { instance, errors } = await check(CreateProductDto, validCreate);
    expect(errors).toHaveLength(0);
    expect(instance.name).toBe('Classic Cotton Hoodie');
  });

  it('normalizes the slug to trimmed lowercase', async () => {
    const { instance, errors } = await check(CreateProductDto, {
      ...validCreate,
      slug: '  Classic-Hoodie ',
    });
    expect(errors).toHaveLength(0);
    expect(instance.slug).toBe('classic-hoodie');
  });

  it('rejects an invalid slug format', async () => {
    const { errors } = await check(CreateProductDto, {
      ...validCreate,
      slug: 'bad--slug',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects status, stockQuantity and unknown fields', async () => {
    for (const extra of [
      { status: 'ACTIVE' },
      { stockQuantity: 5 },
      { currency: 'USD' },
    ]) {
      const { errors } = await check(CreateProductDto, {
        ...validCreate,
        ...extra,
      });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('accepts valid money strings', async () => {
    for (const price of ['55', '55.00', '99999999.99']) {
      const { errors } = await check(CreateProductDto, {
        ...validCreate,
        price,
      });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects invalid money values', async () => {
    for (const price of ['-1', '55.123', 55, '100000000.00', 'abc', '']) {
      const { errors } = await check(CreateProductDto, {
        ...validCreate,
        price,
      });
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects a missing or invalid gender, category and brand', async () => {
    expect(
      (await check(CreateProductDto, { ...validCreate, gender: 'KIDS' }))
        .errors.length,
    ).toBeGreaterThan(0);
    expect(
      (await check(CreateProductDto, { ...validCreate, categoryId: 'x' }))
        .errors.length,
    ).toBeGreaterThan(0);
    expect(
      (await check(CreateProductDto, { ...validCreate, brandId: 'x' })).errors
        .length,
    ).toBeGreaterThan(0);
  });

  it('accepts null brandId and null sizeType, and valid sizeType values', async () => {
    const nulls = await check(CreateProductDto, {
      ...validCreate,
      brandId: null,
      sizeType: null,
    });
    expect(nulls.errors).toHaveLength(0);

    const footwear = await check(CreateProductDto, {
      ...validCreate,
      sizeType: SizeType.FOOTWEAR,
    });
    expect(footwear.errors).toHaveLength(0);

    const invalid = await check(CreateProductDto, {
      ...validCreate,
      sizeType: 'ONE_SIZE',
    });
    expect(invalid.errors.length).toBeGreaterThan(0);
  });

  it('enforces the SEO and short description length limits', async () => {
    expect(
      (
        await check(CreateProductDto, {
          ...validCreate,
          metaTitle: 'a'.repeat(71),
        })
      ).errors.length,
    ).toBeGreaterThan(0);
    expect(
      (
        await check(CreateProductDto, {
          ...validCreate,
          metaDescription: 'a'.repeat(161),
        })
      ).errors.length,
    ).toBeGreaterThan(0);
    expect(
      (
        await check(CreateProductDto, {
          ...validCreate,
          shortDescription: 'a'.repeat(301),
        })
      ).errors.length,
    ).toBeGreaterThan(0);
  });
});

describe('UpdateProductDto', () => {
  it('accepts an empty payload and partial updates', async () => {
    expect((await check(UpdateProductDto, {})).errors).toHaveLength(0);
    expect(
      (await check(UpdateProductDto, { price: '60.00', isFeatured: true }))
        .errors,
    ).toHaveLength(0);
  });

  it('rejects status and stockQuantity', async () => {
    expect(
      (await check(UpdateProductDto, { status: 'ACTIVE' })).errors.length,
    ).toBeGreaterThan(0);
    expect(
      (await check(UpdateProductDto, { stockQuantity: 1 })).errors.length,
    ).toBeGreaterThan(0);
  });

  it('still validates the fields that are sent', async () => {
    expect(
      (await check(UpdateProductDto, { price: '-5' })).errors.length,
    ).toBeGreaterThan(0);
    expect(
      (await check(UpdateProductDto, { slug: 'Bad Slug' })).errors.length,
    ).toBeGreaterThan(0);
  });
});

describe('SetProductTagsDto', () => {
  it('accepts a list of unique UUIDs and an empty list', async () => {
    expect(
      (await check(SetProductTagsDto, { tagIds: [UUID] })).errors,
    ).toHaveLength(0);
    expect(
      (await check(SetProductTagsDto, { tagIds: [] })).errors,
    ).toHaveLength(0);
  });

  it('rejects duplicates, non-UUIDs, non-arrays and oversized lists', async () => {
    expect(
      (await check(SetProductTagsDto, { tagIds: [UUID, UUID] })).errors.length,
    ).toBeGreaterThan(0);
    expect(
      (await check(SetProductTagsDto, { tagIds: ['nope'] })).errors.length,
    ).toBeGreaterThan(0);
    expect(
      (await check(SetProductTagsDto, { tagIds: UUID })).errors.length,
    ).toBeGreaterThan(0);

    const many = Array.from(
      { length: 51 },
      (_, i) => `3f1c2b7e-8d4a-4c5b-9e6f-${String(i).padStart(12, '0')}`,
    );
    expect(
      (await check(SetProductTagsDto, { tagIds: many })).errors.length,
    ).toBeGreaterThan(0);
  });
});

describe('AddProductColorDto and AddProductSizeDto', () => {
  it('accept a UUID and reject anything else', async () => {
    expect(
      (await check(AddProductColorDto, { colorId: UUID })).errors,
    ).toHaveLength(0);
    expect(
      (await check(AddProductColorDto, { colorId: 'x' })).errors.length,
    ).toBeGreaterThan(0);
    expect(
      (await check(AddProductSizeDto, { sizeId: UUID })).errors,
    ).toHaveLength(0);
    expect(
      (await check(AddProductSizeDto, {})).errors.length,
    ).toBeGreaterThan(0);
  });
});
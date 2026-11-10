import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ReorderImagesDto } from '../image/reorder-images.dto';
import { UpdateImageDto } from '../image/update-image.dto';
import { UploadImageDto } from '../image/upload-image.dto';
import { AdjustStockDto } from '../variant/adjust-stock.dto';
import { CreateVariantDto } from '../variant/create-variant.dto';
import { SetStockDto } from '../variant/set-stock.dto';
import { UpdateVariantDto } from '../variant/update-variant.dto';

const UUID_A = '123e4567-e89b-42d3-a456-426614174000';
const UUID_B = '123e4567-e89b-42d3-a456-426614174001';

/**
 * Transforms a plain object into a DTO and validates it with the same
 * options used by the global ValidationPipe.
 */
async function run<T extends object>(
  dtoClass: new () => T,
  plain: Record<string, unknown>,
): Promise<{ instance: T; invalid: string[] }> {
  const instance = plainToInstance(dtoClass, plain);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  return { instance, invalid: errors.map((e) => e.property).sort() };
}

describe('Variant and image DTOs', () => {
  describe('CreateVariantDto', () => {
    it('normalizes the sku and accepts a full payload', async () => {
      const { instance, invalid } = await run(CreateVariantDto, {
        colorId: UUID_A,
        sizeId: UUID_B,
        sku: '  hd-blk-m ',
        price: '55.00',
        stockQuantity: 10,
        isActive: true,
      });

      expect(invalid).toEqual([]);
      expect(instance.sku).toBe('HD-BLK-M');
    });

    it('accepts a sizeless variant with null size and null price', async () => {
      const { invalid } = await run(CreateVariantDto, {
        colorId: UUID_A,
        sizeId: null,
        sku: 'BAG-BLK',
        price: null,
      });

      expect(invalid).toEqual([]);
    });

    it.each([
      ['bad sku', { sku: 'bad sku' }, 'sku'],
      ['blank sku', { sku: '   ' }, 'sku'],
      ['sku starting with hyphen', { sku: '-A' }, 'sku'],
      ['negative price', { price: '-1' }, 'price'],
      ['three decimals', { price: '1.234' }, 'price'],
      ['numeric price', { price: 55 }, 'price'],
      ['negative stock', { stockQuantity: -1 }, 'stockQuantity'],
      ['fractional stock', { stockQuantity: 1.5 }, 'stockQuantity'],
      ['huge stock', { stockQuantity: 1000001 }, 'stockQuantity'],
      ['invalid colorId', { colorId: 'nope' }, 'colorId'],
      ['invalid sizeId', { sizeId: 'nope' }, 'sizeId'],
      ['unknown property', { productId: UUID_A }, 'productId'],
    ])('rejects %s', async (_label, override, property) => {
      const { invalid } = await run(CreateVariantDto, {
        colorId: UUID_A,
        sku: 'OK-SKU',
        ...override,
      });

      expect(invalid).toContain(property);
    });
  });

  describe('UpdateVariantDto', () => {
    it('accepts partial updates and null price', async () => {
      expect((await run(UpdateVariantDto, {})).invalid).toEqual([]);
      expect((await run(UpdateVariantDto, { price: null })).invalid).toEqual([]);
      expect((await run(UpdateVariantDto, { isActive: false })).invalid).toEqual([]);
    });

    it('normalizes the sku', async () => {
      const { instance } = await run(UpdateVariantDto, { sku: ' new-sku ' });

      expect(instance.sku).toBe('NEW-SKU');
    });

    it.each(['colorId', 'sizeId', 'stockQuantity'])(
      'rejects %s',
      async (field) => {
        const value = field === 'stockQuantity' ? 5 : UUID_A;
        const { invalid } = await run(UpdateVariantDto, { [field]: value });

        expect(invalid).toContain(field);
      },
    );
  });

  describe('SetStockDto', () => {
    it('accepts 0 and positive integers', async () => {
      expect((await run(SetStockDto, { stockQuantity: 0 })).invalid).toEqual([]);
      expect((await run(SetStockDto, { stockQuantity: 25 })).invalid).toEqual([]);
    });

    it.each([-1, 1.5, 1000001, '5'])('rejects %p', async (stockQuantity) => {
      const { invalid } = await run(SetStockDto, { stockQuantity });

      expect(invalid).toContain('stockQuantity');
    });
  });

  describe('AdjustStockDto', () => {
    it('accepts positive and negative integers', async () => {
      expect((await run(AdjustStockDto, { delta: 5 })).invalid).toEqual([]);
      expect((await run(AdjustStockDto, { delta: -5 })).invalid).toEqual([]);
    });

    it.each([0, 1.5, 1000001, -1000001])('rejects %p', async (delta) => {
      const { invalid } = await run(AdjustStockDto, { delta });

      expect(invalid).toContain('delta');
    });
  });

  describe('UploadImageDto', () => {
    it('treats empty strings as not provided', async () => {
      const { instance, invalid } = await run(UploadImageDto, {
        colorId: '',
        altText: '   ',
      });

      expect(invalid).toEqual([]);
      expect(instance.colorId).toBeUndefined();
      expect(instance.altText).toBeUndefined();
    });

    it('accepts a color and alt text', async () => {
      const { instance, invalid } = await run(UploadImageDto, {
        colorId: UUID_A,
        altText: '  Front view ',
      });

      expect(invalid).toEqual([]);
      expect(instance.altText).toBe('Front view');
    });

    it('rejects an invalid colorId and a long altText', async () => {
      const { invalid } = await run(UploadImageDto, {
        colorId: 'nope',
        altText: 'a'.repeat(256),
      });

      expect(invalid).toEqual(['altText', 'colorId']);
    });
  });

  describe('UpdateImageDto', () => {
    it('accepts altText and null', async () => {
      expect((await run(UpdateImageDto, { altText: 'New' })).invalid).toEqual([]);
      expect((await run(UpdateImageDto, { altText: null })).invalid).toEqual([]);
    });

    it('rejects colorId and sortOrder', async () => {
      const { invalid } = await run(UpdateImageDto, {
        colorId: UUID_A,
        sortOrder: 1,
      });

      expect(invalid).toEqual(['colorId', 'sortOrder']);
    });
  });

  describe('ReorderImagesDto', () => {
    it('accepts a valid order for the general group', async () => {
      const { invalid } = await run(ReorderImagesDto, {
        imageIds: [UUID_A, UUID_B],
      });

      expect(invalid).toEqual([]);
    });

    it('accepts a color group and a null group', async () => {
      expect(
        (await run(ReorderImagesDto, { colorId: UUID_A, imageIds: [UUID_A] })).invalid,
      ).toEqual([]);
      expect(
        (await run(ReorderImagesDto, { colorId: null, imageIds: [UUID_A] })).invalid,
      ).toEqual([]);
    });

    it.each([
      ['empty list', { imageIds: [] }],
      ['duplicates', { imageIds: [UUID_A, UUID_A] }],
      ['invalid uuid', { imageIds: [UUID_A, 'nope'] }],
      ['more than 20', { imageIds: Array.from({ length: 21 }, (_v, i) => `123e4567-e89b-42d3-a456-4266141740${String(i).padStart(2, '0')}`) }],
      ['not an array', { imageIds: UUID_A }],
    ])('rejects %s', async (_label, payload) => {
      const { invalid } = await run(ReorderImagesDto, payload);

      expect(invalid).toContain('imageIds');
    });

    it('rejects an invalid colorId', async () => {
      const { invalid } = await run(ReorderImagesDto, {
        colorId: 'nope',
        imageIds: [UUID_A],
      });

      expect(invalid).toContain('colorId');
    });
  });
});
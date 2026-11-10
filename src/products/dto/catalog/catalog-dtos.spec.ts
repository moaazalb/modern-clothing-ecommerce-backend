import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CatalogListQueryDto } from './catalog-list-query.dto';
import { CreateBrandDto } from './brand/create-brand.dto';
import { UpdateBrandDto } from './brand/update-brand.dto';
import { CreateCategoryDto } from './category/create-category.dto';
import { UpdateCategoryDto } from './category/update-category.dto';
import { CreateColorDto } from './color/create-color.dto';
import { CreateSizeDto } from './size/create-size.dto';
import { UpdateSizeDto } from './size/update-size.dto';
import { CreateTagDto } from './tag/create-tag.dto';

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

describe('Catalog DTOs', () => {
  describe('CreateCategoryDto', () => {
    it('trims the name, lowercases the slug and accepts a valid payload', async () => {
      const { instance, invalid } = await run(CreateCategoryDto, {
        name: '  T-Shirts  ',
        slug: '  T-Shirts ',
        sortOrder: 3,
      });

      expect(invalid).toEqual([]);
      expect(instance.name).toBe('T-Shirts');
      expect(instance.slug).toBe('t-shirts');
    });

    it('accepts a payload with only a name', async () => {
      const { invalid } = await run(CreateCategoryDto, { name: 'Jeans' });

      expect(invalid).toEqual([]);
    });

    it.each([
      ['blank name', { name: '   ' }, 'name'],
      ['name over 100 chars', { name: 'a'.repeat(101) }, 'name'],
      ['bad slug', { name: 'A', slug: 'Bad Slug!' }, 'slug'],
      ['double hyphen slug', { name: 'A', slug: 'a--b' }, 'slug'],
      ['negative sortOrder', { name: 'A', sortOrder: -1 }, 'sortOrder'],
      ['fractional sortOrder', { name: 'A', sortOrder: 1.5 }, 'sortOrder'],
      ['invalid parentId', { name: 'A', parentId: 'nope' }, 'parentId'],
      ['unknown property', { name: 'A', id: 'x' }, 'id'],
    ])('rejects %s', async (_label, payload, property) => {
      const { invalid } = await run(CreateCategoryDto, payload);

      expect(invalid).toContain(property);
    });

    it('allows null parentId (root category)', async () => {
      const { invalid } = await run(CreateCategoryDto, {
        name: 'Root',
        parentId: null,
      });

      expect(invalid).toEqual([]);
    });
  });

  describe('UpdateCategoryDto', () => {
    it('accepts an empty payload and partial payloads', async () => {
      expect((await run(UpdateCategoryDto, {})).invalid).toEqual([]);
      expect((await run(UpdateCategoryDto, { isActive: false })).invalid).toEqual([]);
    });

    it('allows null to clear description and parentId', async () => {
      const { invalid } = await run(UpdateCategoryDto, {
        description: null,
        parentId: null,
      });

      expect(invalid).toEqual([]);
    });

    it('still validates provided fields', async () => {
      const { invalid } = await run(UpdateCategoryDto, { slug: 'BAD SLUG' });

      expect(invalid).toContain('slug');
    });
  });

  describe('CreateBrandDto / UpdateBrandDto', () => {
    it('accepts https urls', async () => {
      const { invalid } = await run(CreateBrandDto, {
        name: 'Nike',
        logoUrl: 'https://example.com/logo.png',
        websiteUrl: 'https://www.nike.com',
      });

      expect(invalid).toEqual([]);
    });

    it.each([
      'http://example.com/logo.png',
      'javascript:alert(1)',
      'ftp://example.com/logo.png',
      'example.com/logo.png',
    ])('rejects logoUrl %s', async (logoUrl) => {
      const { invalid } = await run(CreateBrandDto, { name: 'Nike', logoUrl });

      expect(invalid).toContain('logoUrl');
    });

    it('allows null to clear urls on update', async () => {
      const { invalid } = await run(UpdateBrandDto, {
        logoUrl: null,
        websiteUrl: null,
        description: null,
      });

      expect(invalid).toEqual([]);
    });
  });

  describe('CreateTagDto', () => {
    it('rejects names over 50 chars and accepts valid ones', async () => {
      expect((await run(CreateTagDto, { name: 'New Arrival' })).invalid).toEqual([]);
      expect((await run(CreateTagDto, { name: 'a'.repeat(51) })).invalid).toContain('name');
    });
  });

  describe('CreateColorDto', () => {
    it('normalizes the hex code to uppercase', async () => {
      const { instance, invalid } = await run(CreateColorDto, {
        name: 'Navy',
        hexCode: ' #00008b ',
      });

      expect(invalid).toEqual([]);
      expect(instance.hexCode).toBe('#00008B');
    });

    it.each(['abc', '#abc', '#GGGGGG', '000080', '#0000800'])(
      'rejects hexCode %s',
      async (hexCode) => {
        const { invalid } = await run(CreateColorDto, { name: 'X', hexCode });

        expect(invalid).toContain('hexCode');
      },
    );
  });

  describe('CreateSizeDto / UpdateSizeDto', () => {
    it('uppercases and trims the code', async () => {
      const { instance, invalid } = await run(CreateSizeDto, {
        name: 'Extra Large',
        code: ' xl ',
        sizeType: 'APPAREL',
      });

      expect(invalid).toEqual([]);
      expect(instance.code).toBe('XL');
    });

    it('rejects an invalid sizeType and a negative sortOrder', async () => {
      const { invalid } = await run(CreateSizeDto, {
        name: 'X',
        code: 'X',
        sizeType: 'KIDS',
        sortOrder: -1,
      });

      expect(invalid).toEqual(['sizeType', 'sortOrder']);
    });

    it('rejects sizeType on update', async () => {
      const { invalid } = await run(UpdateSizeDto, { sizeType: 'FOOTWEAR' });

      expect(invalid).toContain('sizeType');
    });

    it('accepts partial updates', async () => {
      const { invalid } = await run(UpdateSizeDto, { isActive: false });

      expect(invalid).toEqual([]);
    });
  });

  describe('PaginationQueryDto', () => {
    it('applies defaults', async () => {
      const { instance, invalid } = await run(PaginationQueryDto, {});

      expect(invalid).toEqual([]);
      expect(instance.page).toBe(1);
      expect(instance.limit).toBe(20);
    });

    it('converts query strings to numbers', async () => {
      const { instance, invalid } = await run(PaginationQueryDto, {
        page: '2',
        limit: '50',
      });

      expect(invalid).toEqual([]);
      expect(instance.page).toBe(2);
      expect(instance.limit).toBe(50);
    });

    it.each([
      ['page', '0'],
      ['page', 'abc'],
      ['limit', '101'],
      ['limit', '0'],
      ['limit', '1.5'],
    ])('rejects %s=%s', async (key, value) => {
      const { invalid } = await run(PaginationQueryDto, { [key]: value });

      expect(invalid).toContain(key);
    });
  });

  describe('CatalogListQueryDto', () => {
    it('converts "true" and "false" to booleans', async () => {
      const yes = await run(CatalogListQueryDto, { isActive: 'true' });
      const no = await run(CatalogListQueryDto, { isActive: 'false' });

      expect(yes.invalid).toEqual([]);
      expect(yes.instance.isActive).toBe(true);
      expect(no.invalid).toEqual([]);
      expect(no.instance.isActive).toBe(false);
    });

    it('rejects other isActive values', async () => {
      const { invalid } = await run(CatalogListQueryDto, { isActive: 'abc' });

      expect(invalid).toContain('isActive');
    });

    it('trims the search text and limits its length', async () => {
      const ok = await run(CatalogListQueryDto, { q: '  shirt ' });
      const tooLong = await run(CatalogListQueryDto, { q: 'a'.repeat(101) });

      expect(ok.instance.q).toBe('shirt');
      expect(tooLong.invalid).toContain('q');
    });
  });
});
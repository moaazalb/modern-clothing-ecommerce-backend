import { escapeLike } from './escape-like.util';
import { slugify } from './slug.util';

describe('slugify', () => {
  it('lowercases and joins words with single hyphens', () => {
    expect(slugify('  Classic Cotton Hoodie ', 220)).toBe(
      'classic-cotton-hoodie',
    );
  });

  it('removes accents and collapses symbols', () => {
    expect(slugify('Café & Crème -- Été!', 220)).toBe('cafe-creme-ete');
  });

  it('returns an empty string when no Latin letter or digit exists', () => {
    expect(slugify('قمصان', 120)).toBe('');
    expect(slugify('!!!', 120)).toBe('');
  });

  it('respects the maximum length without a trailing hyphen', () => {
    const slug = slugify('abcde fghij', 6);
    expect(slug).toBe('abcde');
    expect(slug.length).toBeLessThanOrEqual(6);
  });

  it('always produces a value matching the slug format', () => {
    const slug = slugify('Men’s T-Shirts 2026 (New)', 120);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('escapeLike', () => {
  it('escapes %, _ and backslash', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('leaves normal text unchanged', () => {
    expect(escapeLike('hoodie')).toBe('hoodie');
  });
});
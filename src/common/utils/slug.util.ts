/**
 * Converts free text into a URL slug.
 *
 * Accents are removed and every run of characters other than a-z and 0-9
 * becomes a single hyphen. Text without any Latin letter or digit (for
 * example Arabic-only names) produces an empty string, so callers must
 * handle the empty result and ask for an explicit slug.
 *
 * @param text Source text, usually a name.
 * @param maxLength Maximum length of the generated slug.
 * @returns A slug matching ^[a-z0-9]+(-[a-z0-9]+)*$, or an empty string.
 */
export function slugify(text: string, maxLength: number): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}
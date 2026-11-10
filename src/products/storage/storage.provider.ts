/**
 * Contract of a file storage provider.
 *
 * It is an abstract class so it can also be used as the injection token:
 * the products module depends on this contract only, and the provider can
 * change (local disk, S3, Cloudinary...) without touching product code.
 *
 * The database stores only the storage key, never an absolute URL.
 */
export abstract class StorageProvider {
  /**
   * Saves a file under a storage key. It never overwrites an existing file.
   *
   * @param key Relative storage key (e.g. products/{productId}/{uuid}.webp).
   * @param content File content.
   * @param contentType MIME type of the file.
   */
  abstract save(key: string, content: Buffer, contentType: string): Promise<void>;

  /**
   * Deletes a file. Deleting a missing file is not an error.
   *
   * @param key Relative storage key.
   */
  abstract delete(key: string): Promise<void>;

  /**
   * Builds the public URL of a stored file.
   *
   * @param key Relative storage key.
   * @returns The public URL.
   */
  abstract getPublicUrl(key: string): string;
}
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

import { StorageProvider } from './storage.provider';

/**
 * URL prefix under which the local upload folder is served.
 */
const PUBLIC_PREFIX = 'uploads';

/**
 * Stores files on the local disk (development).
 *
 * Settings (all optional):
 * - STORAGE_LOCAL_DIR: upload folder, relative to the project (default "uploads").
 * - PUBLIC_BASE_URL: public address of the API (default http://localhost:PORT).
 */
@Injectable()
export class LocalStorageProvider extends StorageProvider {
  private readonly rootDir: string;
  private readonly publicBaseUrl: string;

  /**
   * Reads the storage settings.
   *
   * @param configService Provides environment configuration.
   */
  constructor(configService: ConfigService) {
    super();

    this.rootDir = resolve(
      process.cwd(),
      configService.get<string>('STORAGE_LOCAL_DIR') ?? 'uploads',
    );

    const port = configService.get<string>('PORT') ?? '4000';

    this.publicBaseUrl = (
      configService.get<string>('PUBLIC_BASE_URL') ?? `http://localhost:${port}`
    ).replace(/\/+$/, '');
  }

  /**
   * Returns the folder that contains the uploaded files (for static serving).
   *
   * @returns Absolute path of the upload folder.
   */
  getRootDirectory(): string {
    return this.rootDir;
  }

  /**
   * Resolves a storage key to a file path and refuses any path that
   * escapes the upload folder.
   *
   * @param key Relative storage key.
   * @returns Absolute file path.
   * @throws Error If the key points outside the upload folder.
   */
  private resolveSafePath(key: string): string {
    const target = resolve(this.rootDir, key);

    if (!target.startsWith(this.rootDir + sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }

    return target;
  }

  /**
   * Saves a file. Fails if the file already exists.
   *
   * @param key Relative storage key.
   * @param content File content.
   */
  async save(key: string, content: Buffer): Promise<void> {
    const target = this.resolveSafePath(key);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { flag: 'wx' });
  }

  /**
   * Deletes a file. A missing file is ignored.
   *
   * @param key Relative storage key.
   */
  async delete(key: string): Promise<void> {
    await rm(this.resolveSafePath(key), { force: true });
  }

  /**
   * Builds the public URL of a stored file.
   *
   * @param key Relative storage key.
   * @returns The public URL.
   */
  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${PUBLIC_PREFIX}/${key}`;
  }
}
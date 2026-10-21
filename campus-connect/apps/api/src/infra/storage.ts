import { createReadStream } from 'node:fs';
import { access, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CircuitBreaker, CircuitOpenError } from '../core/circuit-breaker.js';
import { hmac, safeEqual } from '../core/crypto.js';
import { Errors } from '../core/errors.js';
import type { Config } from '../config/env.js';

// Object storage for uploads. Two drivers share one interface:
//   local - files on disk under var/storage (development, single server)
//   s3    - any S3-compatible service (Cloudflare R2, AWS S3, MinIO)
// The bytes never pass through Postgres; the database keeps metadata only (see `files`).
// A circuit breaker isolates storage outages: uploads and downloads fail with a clear 503 while
// every feature that does not touch files keeps working.

const KEY_PATTERN = /^[a-z0-9][a-z0-9/._-]{2,390}$/;

export interface StoredObject {
  stream: Readable;
  size?: number;
}

/** Inclusive byte range, as in an HTTP Range header (used for video/audio seeking). */
export interface ByteRange {
  start: number;
  end: number;
}

interface Driver {
  readonly name: 'local' | 's3';
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string, range?: ByteRange): Promise<StoredObject>;
  size(key: string): Promise<number>;
  delete(key: string): Promise<void>;
  presignGet?(key: string, expiresSeconds: number, downloadName: string, contentType: string): Promise<string>;
  ping(): Promise<void>;
}

function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.includes('..') || key.includes('//')) {
    throw new Error(`Refusing unsafe storage key: ${key}`);
  }
}

class LocalDriver implements Driver {
  readonly name = 'local' as const;

  constructor(private readonly baseDir: string) {}

  private pathFor(key: string): string {
    assertKey(key);
    const full = resolve(this.baseDir, key);
    // Defence in depth against path traversal.
    if (!full.startsWith(resolve(this.baseDir) + sep)) throw new Error('Storage path escapes the base directory');
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { flag: 'wx' }); // never overwrite an existing object
  }

  async get(key: string, range?: ByteRange): Promise<StoredObject> {
    const path = this.pathFor(key);
    const info = await stat(path);
    if (range) return { stream: createReadStream(path, { start: range.start, end: range.end }), size: range.end - range.start + 1 };
    return { stream: createReadStream(path), size: info.size };
  }

  async size(key: string): Promise<number> {
    return (await stat(this.pathFor(key))).size;
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async ping(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    await access(this.baseDir);
  }
}

class S3Driver implements Driver {
  readonly name = 's3' as const;
  private readonly client: S3Client;

  constructor(private readonly bucket: string, options: Config['storage']['s3']) {
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: Boolean(options.endpoint),
      credentials: { accessKeyId: options.accessKeyId ?? '', secretAccessKey: options.secretAccessKey ?? '' },
      maxAttempts: 2,
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    assertKey(key);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, IfNoneMatch: '*' }),
    );
  }

  async get(key: string, range?: ByteRange): Promise<StoredObject> {
    assertKey(key);
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }),
    );
    return { stream: res.Body as Readable, size: res.ContentLength };
  }

  async size(key: string): Promise<number> {
    assertKey(key);
    const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return res.ContentLength ?? 0;
  }

  async delete(key: string): Promise<void> {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async presignGet(key: string, expiresSeconds: number, downloadName: string, contentType: string): Promise<string> {
    assertKey(key);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: contentType,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      }),
      { expiresIn: expiresSeconds },
    );
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}

export type FileVariant = 'original' | 'thumb';

export class Storage {
  private readonly driver: Driver;
  readonly breaker = new CircuitBreaker('storage', { failureThreshold: 3, cooldownMs: 15_000 });

  constructor(private readonly config: Config) {
    this.driver =
      config.storage.driver === 's3'
        ? new S3Driver(config.storage.s3.bucket ?? '', config.storage.s3)
        : new LocalDriver(config.storage.localDir);
  }

  get driverName(): 'local' | 's3' {
    return this.driver.name;
  }

  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.breaker.exec(fn, (err) => (err as NodeJS.ErrnoException).code !== 'ENOENT');
    } catch (err) {
      if (err instanceof CircuitOpenError) throw Errors.unavailable('file storage');
      if ((err as NodeJS.ErrnoException).code === 'ENOENT' || (err as { name?: string }).name === 'NoSuchKey') {
        throw Errors.notFound('This file');
      }
      throw err;
    }
  }

  put(key: string, body: Buffer, contentType: string) {
    return this.guard(() => this.driver.put(key, body, contentType));
  }

  get(key: string, range?: ByteRange) {
    return this.guard(() => this.driver.get(key, range));
  }

  size(key: string) {
    return this.guard(() => this.driver.size(key));
  }

  delete(key: string) {
    return this.guard(() => this.driver.delete(key));
  }

  async ping(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.driver.ping();
      this.breaker.onSuccess();
      return { ok: true };
    } catch (err) {
      this.breaker.onFailure(err);
      return { ok: false, error: (err as Error).message };
    }
  }

  /**
   * A short-lived link to a file. With S3 this is a presigned bucket URL; locally it is an API
   * URL carrying an HMAC signature and expiry, verified by `verifySignature` before streaming.
   */
  async signedUrl(
    file: { id: string; storageKey: string; originalName: string; mimeType: string },
    variant: FileVariant = 'original',
    expiresSeconds = 3600,
  ): Promise<string> {
    const key = variant === 'thumb' ? `${file.storageKey}.thumb.webp` : file.storageKey;
    if (this.driver.presignGet) {
      return this.driver.presignGet(key, expiresSeconds, file.originalName, variant === 'thumb' ? 'image/webp' : file.mimeType);
    }
    // Round the expiry to the minute so the same link is reused (and browser-cached) briefly.
    const exp = Math.ceil((Date.now() / 1000 + expiresSeconds) / 60) * 60;
    const sig = hmac(this.config.secrets.fileSigning, `${file.id}:${variant}:${exp}`);
    return `${this.config.publicApiUrl}/v1/files/${file.id}/content?v=${variant}&exp=${exp}&sig=${sig}`;
  }

  verifySignature(fileId: string, variant: string, exp: number, sig: string): boolean {
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
    return safeEqual(sig, hmac(this.config.secrets.fileSigning, `${fileId}:${variant}:${exp}`));
  }
}

import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export type FileOperation = 'upload' | 'download';

interface FileTokenPayload {
  key: string;
  op: FileOperation;
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Two interchangeable drivers behind the same presign contract:
 *
 * - S3 (cloud): active when RAILWAY_BUCKET_NAME is set. Presign endpoints
 *   return real S3 presigned URLs; files never touch this server.
 * - Local disk (desktop & dev without bucket): presign endpoints return URLs
 *   pointing back at this API (/api/storage/files) carrying a short-lived
 *   signed token — mimicking S3 semantics where the URL itself is the
 *   credential. Files live next to the SQLite database.
 *
 * The frontend treats the URLs as opaque, so it works unchanged with both.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private client?: S3Client;
  private bucket: string;

  private localRoot: string;
  private localBaseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  onModuleInit() {
    const bucket = this.config.get<string>('RAILWAY_BUCKET_NAME');
    if (bucket) {
      this.bucket = bucket;
      this.client = new S3Client({
        endpoint: this.config.getOrThrow<string>('RAILWAY_BUCKET_ENDPOINT'),
        region: this.config.get<string>('RAILWAY_BUCKET_REGION', 'us-east-1'),
        credentials: {
          accessKeyId: this.config.getOrThrow<string>('RAILWAY_ACCESS_KEY_ID'),
          secretAccessKey: this.config.getOrThrow<string>(
            'RAILWAY_SECRET_ACCESS_KEY',
          ),
        },
        // Required for non-AWS S3-compatible endpoints (Railway, MinIO, etc.)
        forcePathStyle: true,
      });
      return;
    }

    // Local-disk driver: files live next to the SQLite database (desktop:
    // app_data_dir injected by Tauri; dev: the project folder).
    const dbPath = resolve(this.config.get<string>('DATABASE_PATH', 'app.db'));
    this.localRoot = resolve(
      this.config.get<string>('STORAGE_PATH') ?? join(dirname(dbPath), 'files'),
    );
    mkdirSync(this.localRoot, { recursive: true });
    this.localBaseUrl = `http://127.0.0.1:${this.config.get<string>('PORT', '3000')}`;
  }

  get isLocal(): boolean {
    return !this.client;
  }

  /** Called from bootstrap once the HTTP server knows its actual port. */
  setLocalBaseUrl(url: string): void {
    this.localBaseUrl = url;
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 300,
  ): Promise<string> {
    if (this.isLocal) {
      return this.buildLocalUrl(key, 'upload', expiresIn);
    }
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.requireClient(), command, { expiresIn });
  }

  async getPresignedDownloadUrl(
    key: string,
    expiresIn = 3600,
  ): Promise<string> {
    if (this.isLocal) {
      return this.buildLocalUrl(key, 'download', expiresIn);
    }
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.requireClient(), command, { expiresIn });
  }

  /** Validates the token a local file URL carries (the URL is the credential). */
  async verifyFileToken(
    token: string,
    key: string,
    op: FileOperation,
  ): Promise<void> {
    if (!this.isLocal) {
      throw new ServiceUnavailableException('Local file storage is not active');
    }
    let payload: FileTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<FileTokenPayload>(token);
    } catch {
      throw new ForbiddenException('Invalid or expired file token');
    }
    if (payload.key !== key || payload.op !== op) {
      throw new ForbiddenException(
        'Token does not match the requested operation',
      );
    }
  }

  /** Streams the request body to disk; rejects oversized or parsed bodies. */
  async saveLocalFile(key: string, req: Request): Promise<number> {
    const absPath = this.resolveLocalPath(key);
    // Body parsers mark consumed streams; a consumed stream would silently
    // write an empty file (e.g. an upload sent as application/json).
    if ((req as { _body?: boolean })._body) {
      throw new BadRequestException(
        'Unsupported content type for file upload — send the raw file body',
      );
    }
    mkdirSync(dirname(absPath), { recursive: true });
    let bytes = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > MAX_UPLOAD_BYTES) {
          callback(
            new PayloadTooLargeException(
              `File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024} MB upload limit`,
            ),
          );
          return;
        }
        callback(null, chunk);
      },
    });
    try {
      await pipeline(req, limiter, createWriteStream(absPath));
    } catch (error) {
      await rm(absPath, { force: true });
      throw error;
    }
    return bytes;
  }

  getLocalFilePath(key: string): string {
    const absPath = this.resolveLocalPath(key);
    if (!existsSync(absPath)) {
      throw new NotFoundException('File not found');
    }
    return absPath;
  }

  private async buildLocalUrl(
    key: string,
    op: FileOperation,
    expiresIn: number,
  ): Promise<string> {
    this.resolveLocalPath(key); // reject invalid keys before signing
    const payload: FileTokenPayload = { key, op };
    const token = await this.jwt.signAsync(payload, { expiresIn });
    return `${this.localBaseUrl}/api/storage/files?key=${encodeURIComponent(key)}&token=${token}`;
  }

  /** Maps a storage key to an absolute path, rejecting traversal attempts. */
  private resolveLocalPath(key: string): string {
    const valid =
      key.length > 0 &&
      key.length <= 512 &&
      /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key) &&
      !key.split('/').some((segment) => segment === '..' || segment === '');
    if (!valid) {
      throw new BadRequestException('Invalid storage key');
    }
    const absPath = resolve(this.localRoot, key);
    const rel = relative(this.localRoot, absPath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new BadRequestException('Invalid storage key');
    }
    return absPath;
  }

  private requireClient(): S3Client {
    if (!this.client) {
      throw new ServiceUnavailableException('File storage is not configured');
    }
    return this.client;
  }
}

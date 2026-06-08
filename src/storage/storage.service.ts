import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: S3Client;
  private bucket: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.bucket = this.config.getOrThrow<string>('RAILWAY_BUCKET_NAME');
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
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 300,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async getPresignedDownloadUrl(
    key: string,
    expiresIn = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}

/**
 * Configures CORS on the Railway Storage bucket.
 * Run once per environment:
 *   npx ts-node scripts/set-bucket-cors.ts
 *
 * Reads credentials from .env (or environment variables).
 */
import { PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ALLOWED_ORIGINS = [
  'http://localhost:4200', // roller-admin dev
  'http://localhost:4201', // roller-client dev (if applicable)
  // Add staging/prod origins here when needed:
  // 'https://admin.yourdomain.com',
];

const client = new S3Client({
  endpoint: process.env.RAILWAY_BUCKET_ENDPOINT!,
  region: process.env.RAILWAY_BUCKET_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.RAILWAY_ACCESS_KEY_ID!,
    secretAccessKey: process.env.RAILWAY_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

async function main() {
  const bucket = process.env.RAILWAY_BUCKET_NAME!;

  if (!bucket || !process.env.RAILWAY_BUCKET_ENDPOINT) {
    console.error('Missing RAILWAY_BUCKET_* env vars. Check your .env file.');
    process.exit(1);
  }

  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ALLOWED_ORIGINS,
            AllowedMethods: ['PUT', 'GET'],
            AllowedHeaders: ['Content-Type'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  console.log(`CORS configured on bucket "${bucket}" for origins:`);
  ALLOWED_ORIGINS.forEach((o) => console.log(`  ${o}`));
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

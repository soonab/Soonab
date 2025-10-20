// src/lib/s3.ts
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let client: S3Client | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} missing`);
  return value;
}

export function getS3Client(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: required('AWS_REGION'),
    credentials: {
      accessKeyId: required('AWS_ACCESS_KEY_ID'),
      secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
    },
  });
  return client;
}

export function getBucketName() {
  return required('S3_BUCKET');
}

export async function signPutURL(key: string, contentType: string, contentLength: number) {
  const cmd = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
    ACL: 'private',
  });
  return getSignedUrl(getS3Client(), cmd, { expiresIn: 60 });
}

export { PutObjectCommand, GetObjectCommand, HeadObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command };

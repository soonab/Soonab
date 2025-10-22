// File: src/lib/media/s3.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function required(name: string, val?: string) {
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

export function getS3Client() {
  const region = required("AWS_REGION", process.env.AWS_REGION);
  if (!/^[a-z0-9-]+$/i.test(region)) throw new Error("Invalid AWS_REGION format");
  const creds = {
    accessKeyId: required("AWS_ACCESS_KEY_ID", process.env.AWS_ACCESS_KEY_ID),
    secretAccessKey: required("AWS_SECRET_ACCESS_KEY", process.env.AWS_SECRET_ACCESS_KEY),
  };
  return new S3Client({ region, credentials: creds });
}

/**
 * Create a pre-signed PUT URL for direct browser upload.
 */
export async function signPutURL(opts: {
  key: string;
  bucket?: string;
  contentType: string;
  maxAgeSeconds?: number; // default 15 min
}) {
  const bucket = required("AWS_S3_BUCKET", opts.bucket ?? process.env.AWS_S3_BUCKET);
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: opts.key,
    ContentType: opts.contentType,
    ACL: "private",
  });
  const url = await getSignedUrl(client, command, { expiresIn: opts?.maxAgeSeconds ?? 900 });
  return { url, bucket, region: process.env.AWS_REGION! };
}

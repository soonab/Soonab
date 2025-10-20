# Environment Variables

## Storage (Step-13)

Set these for media uploads:

```
AWS_REGION=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
S3_BUCKET=""
S3_PUBLIC_BASE_URL="https://<your-public-s3-host-or-cdn>"
UPLOAD_MAX_MB="8"
UPLOAD_MAX_IMAGES_PER_ITEM="4"
ALLOWED_IMAGE_TYPES="image/jpeg,image/png,image/webp"
```

Optional: use different limits per environment by overriding `NEXT_PUBLIC_UPLOAD_MAX_IMAGES_PER_ITEM` on the client.

### S3 CORS configuration

Configure your bucket CORS rules:

```
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000", "https://*.vercel.app", "https://alinkah.com"],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3000
  }
]
```

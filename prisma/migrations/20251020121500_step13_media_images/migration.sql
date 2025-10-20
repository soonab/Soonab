-- Step-13 Media images

CREATE TYPE "MediaKind" AS ENUM ('IMAGE');
CREATE TYPE "MediaStatus" AS ENUM ('UPLOADING', 'READY', 'DELETING', 'DELETED');
CREATE TYPE "VariantRole" AS ENUM ('ORIGINAL', 'LARGE', 'THUMB');

CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "ownerProfileId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'IMAGE',
    "status" "MediaStatus" NOT NULL DEFAULT 'UPLOADING',
    "ext" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaVariant" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "role" "VariantRole" NOT NULL,
    "key" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostMedia" (
    "postId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("postId", "mediaId")
);

CREATE TABLE "DMMessageMedia" (
    "messageId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    CONSTRAINT "DMMessageMedia_pkey" PRIMARY KEY ("messageId", "mediaId")
);

CREATE UNIQUE INDEX "MediaVariant_key_key" ON "MediaVariant"("key");
CREATE INDEX "Media_ownerProfileId_createdAt_idx" ON "Media"("ownerProfileId", "createdAt");

ALTER TABLE "Media"
  ADD CONSTRAINT "Media_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MediaVariant"
  ADD CONSTRAINT "MediaVariant_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostMedia"
  ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostMedia"
  ADD CONSTRAINT "PostMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DMMessageMedia"
  ADD CONSTRAINT "DMMessageMedia_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DMMessageMedia"
  ADD CONSTRAINT "DMMessageMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

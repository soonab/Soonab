-- CreateEnum
CREATE TYPE "CollectionVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- DropForeignKey
ALTER TABLE "Collection" DROP CONSTRAINT "Collection_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "CollectionEntry" DROP CONSTRAINT "CollectionEntry_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "CollectionEntry" DROP CONSTRAINT "CollectionEntry_postId_fkey";

-- DropIndex
DROP INDEX "CollectionEntry_addedAt_idx";

-- AlterTable
ALTER TABLE "Collection" ALTER COLUMN "slug" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "title" SET DATA TYPE VARCHAR(128),
DROP COLUMN "visibility",
ADD COLUMN     "visibility" "CollectionVisibility" NOT NULL DEFAULT 'PUBLIC';

-- CreateIndex
CREATE INDEX "Collection_ownerId_createdAt_idx" ON "Collection"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "CollectionEntry_collectionId_addedAt_idx" ON "CollectionEntry"("collectionId", "addedAt" DESC);

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionEntry" ADD CONSTRAINT "CollectionEntry_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionEntry" ADD CONSTRAINT "CollectionEntry_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

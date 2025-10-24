/*
  Warnings:

  - A unique constraint covering the columns `[postId,raterProfileId]` on the table `PostRating` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PostRating" ADD COLUMN     "raterProfileId" TEXT;

-- CreateIndex
CREATE INDEX "PostRating_raterProfileId_idx" ON "PostRating"("raterProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "PostRating_postId_raterProfileId_key" ON "PostRating"("postId", "raterProfileId");

-- AddForeignKey
ALTER TABLE "PostRating" ADD CONSTRAINT "PostRating_raterProfileId_fkey" FOREIGN KEY ("raterProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

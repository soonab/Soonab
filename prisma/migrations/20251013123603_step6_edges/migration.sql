-- CreateTable
CREATE TABLE "Follow" (
    "followerProfileId" TEXT NOT NULL,
    "followingProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerProfileId","followingProfileId")
);

-- CreateTable
CREATE TABLE "Trust" (
    "trusterProfileId" TEXT NOT NULL,
    "trusteeProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trust_pkey" PRIMARY KEY ("trusterProfileId","trusteeProfileId")
);

-- CreateIndex
CREATE INDEX "Follow_followingProfileId_followerProfileId_idx" ON "Follow"("followingProfileId", "followerProfileId");

-- CreateIndex
CREATE INDEX "Follow_createdAt_idx" ON "Follow"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Trust_trusteeProfileId_trusterProfileId_idx" ON "Trust"("trusteeProfileId", "trusterProfileId");

-- CreateIndex
CREATE INDEX "Trust_createdAt_idx" ON "Trust"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerProfileId_fkey" FOREIGN KEY ("followerProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingProfileId_fkey" FOREIGN KEY ("followingProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trust" ADD CONSTRAINT "Trust_trusterProfileId_fkey" FOREIGN KEY ("trusterProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trust" ADD CONSTRAINT "Trust_trusteeProfileId_fkey" FOREIGN KEY ("trusteeProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

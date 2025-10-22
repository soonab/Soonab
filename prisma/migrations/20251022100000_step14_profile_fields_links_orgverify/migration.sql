-- Step-14 Profile fields, links & org verification

-- Create enums
CREATE TYPE "OrgVerifyStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED');
CREATE TYPE "OrgVerifyMethod" AS ENUM ('EMAIL_DOMAIN', 'MANUAL');

-- Alter Profile columns
ALTER TABLE "Profile"
  ADD COLUMN     "bioVisibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN     "location" TEXT,
  ADD COLUMN     "locationVisibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';

-- Profile links table
CREATE TABLE "ProfileLink" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfileLink_profileId_order_idx" ON "ProfileLink"("profileId", "order");

ALTER TABLE "ProfileLink"
  ADD CONSTRAINT "ProfileLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Organization verification table
CREATE TABLE "OrgVerification" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "OrgVerifyStatus" NOT NULL DEFAULT 'PENDING',
    "method" "OrgVerifyMethod" NOT NULL DEFAULT 'EMAIL_DOMAIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    CONSTRAINT "OrgVerification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrgVerification"
  ADD CONSTRAINT "OrgVerification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

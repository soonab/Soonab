-- Enums
DO $$ BEGIN
  CREATE TYPE "SpaceVisibility" AS ENUM ('PUBLIC','INVITE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SpaceRole" AS ENUM ('OWNER','MODERATOR','MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Space: settings, visibility, personal
ALTER TABLE "Space"
  ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "visibility" "SpaceVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "isPersonal" BOOLEAN NOT NULL DEFAULT false;

-- Membership: role + inviter + joinedViaInvite
ALTER TABLE "SpaceMembership"
  ADD COLUMN IF NOT EXISTS "invitedById" TEXT REFERENCES "Profile"("id"),
  ADD COLUMN IF NOT EXISTS "joinedViaInvite" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SpaceMembership"
  ALTER COLUMN "role" TYPE "SpaceRole" USING UPPER("role")::"SpaceRole",
  ALTER COLUMN "role" SET DEFAULT 'MEMBER';

CREATE UNIQUE INDEX IF NOT EXISTS "SpaceMembership_spaceId_profileId_key"
  ON "SpaceMembership"("spaceId","profileId");
CREATE INDEX IF NOT EXISTS "SpaceMembership_invitedBy_idx"
  ON "SpaceMembership"("invitedById");

-- Invites
CREATE TABLE IF NOT EXISTS "SpaceInvite" (
  "id" TEXT PRIMARY KEY,
  "spaceId" TEXT NOT NULL REFERENCES "Space"("id") ON DELETE CASCADE,
  "token" TEXT NOT NULL UNIQUE,
  "usesRemaining" INTEGER NOT NULL DEFAULT 1 CHECK ("usesRemaining" >= 0),
  "expiresAt" TIMESTAMPTZ,
  "createdById" TEXT NOT NULL REFERENCES "Profile"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "SpaceInvite_spaceId_idx" ON "SpaceInvite"("spaceId");

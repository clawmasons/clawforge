-- Migration: Program -> Space evolution
-- Hand-written because drizzle-kit generates DROP+CREATE for renames which loses data.
-- Reference: specs/001-space-tasks/research.md R1

-- Step 1: Rename program table to space
ALTER TABLE "program" RENAME TO "space";

-- Step 2: Rename columns in space table
ALTER TABLE "space" RENAME COLUMN "program_id" TO "space_id";
ALTER TABLE "space" RENAME COLUMN "launched_by" TO "created_by";

-- Step 3: Add new columns to space
ALTER TABLE "space" ADD COLUMN "name" text;
ALTER TABLE "space" ADD COLUMN "description" text;
ALTER TABLE "space" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;

-- Step 4: Backfill space.name with space_id value for existing rows
UPDATE "space" SET "name" = "space_id" WHERE "name" IS NULL;

-- Step 5: Make name NOT NULL after backfill
ALTER TABLE "space" ALTER COLUMN "name" SET NOT NULL;

-- Step 6: Rename program index
ALTER INDEX "program_organizationId_idx" RENAME TO "space_organizationId_idx";

-- Step 7: Add unique index for space name per org
CREATE UNIQUE INDEX "space_name_organizationId_uidx" ON "space" ("name", "organization_id");

-- Step 8: Rename program_member table to space_member
ALTER TABLE "program_member" RENAME TO "space_member";

-- Step 9: Rename FK column in space_member
ALTER TABLE "space_member" RENAME COLUMN "program_id" TO "space_id";

-- Step 10: Rename program_member indexes
ALTER INDEX "program_member_programId_idx" RENAME TO "space_member_spaceId_idx";
ALTER INDEX "program_member_userId_idx" RENAME TO "space_member_userId_idx";
ALTER INDEX "program_member_programId_userId_uidx" RENAME TO "space_member_spaceId_userId_uidx";

-- Step 11: Rename bot.current_program_id to bot.current_space_id
ALTER TABLE "bot" RENAME COLUMN "current_program_id" TO "current_space_id";

-- Step 12: Drop organization.program_id column and its index
DROP INDEX IF EXISTS "organization_programId_uidx";
ALTER TABLE "organization" DROP COLUMN IF EXISTS "program_id";

-- Step 13: Create space_task table
CREATE TABLE "space_task" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "space_id" text NOT NULL REFERENCES "space"("id") ON DELETE CASCADE,
  "bot_id" text REFERENCES "bot"("id") ON DELETE SET NULL,
  "role" text NOT NULL,
  "triggers" text NOT NULL,
  "schedule" text,
  "plan" text NOT NULL,
  "state" text DEFAULT 'idle' NOT NULL,
  "triggered_at" timestamp,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_by" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Step 14: Create space_task indexes
CREATE INDEX "space_task_spaceId_idx" ON "space_task" ("space_id");
CREATE INDEX "space_task_botId_idx" ON "space_task" ("bot_id");
CREATE UNIQUE INDEX "space_task_name_spaceId_uidx" ON "space_task" ("name", "space_id");

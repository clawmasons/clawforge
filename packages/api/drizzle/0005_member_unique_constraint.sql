-- Migration: Add unique constraint to member table
-- Prevents duplicate org memberships (same user + org)
-- Reference: specs/002-member-invitations/data-model.md

-- Step 1: Remove any duplicate member rows (keep earliest created_at)
DELETE FROM "member" a USING "member" b
WHERE a.id > b.id
  AND a.organization_id = b.organization_id
  AND a.user_id = b.user_id;

-- Step 2: Add unique constraint
CREATE UNIQUE INDEX "member_organizationId_userId_uidx" ON "member" ("organization_id", "user_id");

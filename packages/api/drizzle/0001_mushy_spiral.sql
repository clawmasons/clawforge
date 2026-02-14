ALTER TABLE "organization" ADD COLUMN "program_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_programId_uidx" ON "organization" USING btree ("program_id");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "launched_program_id";
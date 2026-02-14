CREATE TABLE "program" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"launched_by" text NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "program_program_id_unique" UNIQUE("program_id")
);
--> statement-breakpoint
ALTER TABLE "program" ADD CONSTRAINT "program_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program" ADD CONSTRAINT "program_launched_by_user_id_fk" FOREIGN KEY ("launched_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "program_organizationId_idx" ON "program" USING btree ("organization_id");
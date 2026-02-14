CREATE TABLE "bot" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"current_program_id" text,
	"current_role" text,
	"status" text DEFAULT 'running' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_api_token" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"label" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "program_member" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bot" ADD CONSTRAINT "bot_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot" ADD CONSTRAINT "bot_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot" ADD CONSTRAINT "bot_current_program_id_program_id_fk" FOREIGN KEY ("current_program_id") REFERENCES "public"."program"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_api_token" ADD CONSTRAINT "org_api_token_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_api_token" ADD CONSTRAINT "org_api_token_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_member" ADD CONSTRAINT "program_member_program_id_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_member" ADD CONSTRAINT "program_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bot_organizationId_idx" ON "bot" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bot_ownerId_idx" ON "bot" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bot_name_organizationId_uidx" ON "bot" USING btree ("name","organization_id");--> statement-breakpoint
CREATE INDEX "org_api_token_organizationId_idx" ON "org_api_token" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_api_token_tokenHash_idx" ON "org_api_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "program_member_programId_idx" ON "program_member" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "program_member_userId_idx" ON "program_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "program_member_programId_userId_uidx" ON "program_member" USING btree ("program_id","user_id");
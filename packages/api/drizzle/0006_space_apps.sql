CREATE TABLE "app" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"navigation" text DEFAULT '[]' NOT NULL,
	"subspace_path" text NOT NULL,
	"app_definition" text NOT NULL,
	"task_definitions" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_app" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"app_id" text NOT NULL,
	"app_slug" text NOT NULL,
	"installed_by" text NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app" ADD CONSTRAINT "app_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "space_app" ADD CONSTRAINT "space_app_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "space_app" ADD CONSTRAINT "space_app_app_id_app_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."app"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "space_app" ADD CONSTRAINT "space_app_installed_by_user_id_fk" FOREIGN KEY ("installed_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "app_organizationId_idx" ON "app" USING btree ("organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "app_slug_organizationId_uidx" ON "app" USING btree ("slug","organization_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "app_subspacePath_organizationId_uidx" ON "app" USING btree ("subspace_path","organization_id");
--> statement-breakpoint
CREATE INDEX "space_app_spaceId_idx" ON "space_app" USING btree ("space_id");
--> statement-breakpoint
CREATE INDEX "space_app_appId_idx" ON "space_app" USING btree ("app_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "space_app_spaceId_appId_uidx" ON "space_app" USING btree ("space_id","app_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "space_app_spaceId_appSlug_uidx" ON "space_app" USING btree ("space_id","app_slug");

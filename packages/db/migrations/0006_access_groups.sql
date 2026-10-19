CREATE TABLE "group_feature" (
	"group_id" uuid NOT NULL,
	"feature_key" text NOT NULL,
	CONSTRAINT "group_feature_group_id_feature_key_pk" PRIMARY KEY("group_id","feature_key")
);
--> statement-breakpoint
CREATE TABLE "user_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_group_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_group_member" (
	"group_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_group_member_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_feature" ADD CONSTRAINT "group_feature_group_id_user_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."user_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_member" ADD CONSTRAINT "user_group_member_group_id_user_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."user_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_member" ADD CONSTRAINT "user_group_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_group_member_user_idx" ON "user_group_member" USING btree ("user_id");--> statement-breakpoint
-- Accounts that existed before approvals keep working.
UPDATE "user" SET "status" = 'active';--> statement-breakpoint
INSERT INTO "user_group" ("name", "description") VALUES
	('Travelers', 'Trip planning and cost splitting'),
	('Full access', 'Trips and personal finance');--> statement-breakpoint
INSERT INTO "group_feature" ("group_id", "feature_key")
	SELECT "id", 'trips' FROM "user_group" WHERE "name" IN ('Travelers', 'Full access')
	UNION ALL
	SELECT "id", 'finance' FROM "user_group" WHERE "name" = 'Full access';--> statement-breakpoint
INSERT INTO "user_group_member" ("group_id", "user_id")
	SELECT g."id", u."id" FROM "user_group" g CROSS JOIN "user" u WHERE g."name" = 'Full access';

CREATE TYPE "public"."ledger_entry_kind" AS ENUM('expense', 'settlement');--> statement-breakpoint
CREATE TYPE "public"."ledger_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"currency" text DEFAULT 'THB' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ledger_id" uuid NOT NULL,
	"kind" "ledger_entry_kind" DEFAULT 'expense' NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"date" date NOT NULL,
	"paid_by" text NOT NULL,
	"split_mode" "split_mode" NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_member" (
	"ledger_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "ledger_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_member_ledger_id_user_id_pk" PRIMARY KEY("ledger_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "ledger_share" (
	"entry_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"percent_bp" integer,
	CONSTRAINT "ledger_share_entry_id_user_id_pk" PRIMARY KEY("entry_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatar_key" text;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_ledger_id_ledger_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledger"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_member" ADD CONSTRAINT "ledger_member_ledger_id_ledger_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."ledger"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_member" ADD CONSTRAINT "ledger_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_share" ADD CONSTRAINT "ledger_share_entry_id_ledger_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."ledger_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_entry_ledger_date_idx" ON "ledger_entry" USING btree ("ledger_id","date");--> statement-breakpoint
CREATE INDEX "ledger_member_user_idx" ON "ledger_member" USING btree ("user_id");--> statement-breakpoint
-- "Full access" now also includes shared money.
INSERT INTO "group_feature" ("group_id", "feature_key")
	SELECT "id", 'shared' FROM "user_group" WHERE "name" = 'Full access'
	ON CONFLICT DO NOTHING;

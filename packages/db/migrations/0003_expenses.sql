CREATE TYPE "public"."expense_category" AS ENUM('food', 'transport', 'shopping', 'stay', 'activity', 'health', 'other');--> statement-breakpoint
CREATE TYPE "public"."split_mode" AS ENUM('equal', 'exact', 'percent');--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"day_date" date NOT NULL,
	"item_id" uuid,
	"title" text NOT NULL,
	"category" "expense_category" DEFAULT 'other' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"fx_rate" text NOT NULL,
	"base_amount_minor" bigint NOT NULL,
	"paid_by" text NOT NULL,
	"split_mode" "split_mode" NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_share" (
	"expense_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"percent_bp" integer,
	CONSTRAINT "expense_share_expense_id_user_id_pk" PRIMARY KEY("expense_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "fx_rates" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "daily_budget_minor" bigint;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_item_id_trip_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."trip_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_share" ADD CONSTRAINT "expense_share_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_share" ADD CONSTRAINT "expense_share_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_trip_day_idx" ON "expense" USING btree ("trip_id","day_date");
CREATE TYPE "public"."finance_category_kind" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."recurring_kind" AS ENUM('income', 'deduction', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."transaction_kind" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TABLE "finance_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" "finance_category_kind" NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#94a3b8' NOT NULL,
	"budget_minor" bigint,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" "transaction_kind" NOT NULL,
	"title" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"date" date NOT NULL,
	"category_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_override" (
	"rule_id" uuid NOT NULL,
	"month" text NOT NULL,
	"amount_minor" bigint,
	"note" text,
	CONSTRAINT "recurring_override_rule_id_month_pk" PRIMARY KEY("rule_id","month")
);
--> statement-breakpoint
CREATE TABLE "recurring_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" "recurring_kind" NOT NULL,
	"name" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"start_month" text NOT NULL,
	"end_month" text,
	"category_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_category" ADD CONSTRAINT "finance_category_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_category_id_finance_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_override" ADD CONSTRAINT "recurring_override_rule_id_recurring_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."recurring_rule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rule" ADD CONSTRAINT "recurring_rule_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_rule" ADD CONSTRAINT "recurring_rule_category_id_finance_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_category_owner_idx" ON "finance_category" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "finance_transaction_owner_date_idx" ON "finance_transaction" USING btree ("owner_id","date");--> statement-breakpoint
CREATE INDEX "recurring_rule_owner_idx" ON "recurring_rule" USING btree ("owner_id");
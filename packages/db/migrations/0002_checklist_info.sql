CREATE TYPE "public"."info_card_kind" AS ENUM('flight', 'hotel', 'health', 'lounge', 'emergency', 'tip', 'other');--> statement-breakpoint
CREATE TABLE "checklist_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"group_key" text NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_tick" (
	"item_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"ticked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checklist_tick_item_id_user_id_pk" PRIMARY KEY("item_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "info_card" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"kind" "info_card_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_tick" ADD CONSTRAINT "checklist_tick_item_id_checklist_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."checklist_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_tick" ADD CONSTRAINT "checklist_tick_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "info_card" ADD CONSTRAINT "info_card_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_item_trip_idx" ON "checklist_item" USING btree ("trip_id","group_key");--> statement-breakpoint
CREATE INDEX "info_card_trip_idx" ON "info_card" USING btree ("trip_id");
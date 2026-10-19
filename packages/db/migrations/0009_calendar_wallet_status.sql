CREATE TABLE "calendar_feed" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"trip_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD COLUMN "settles_month" text;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD COLUMN "settles_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "calendar_feed" ADD CONSTRAINT "calendar_feed_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_feed" ADD CONSTRAINT "calendar_feed_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feed_user_trip_idx" ON "calendar_feed" USING btree ("user_id","trip_id");--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_settles_entry_id_ledger_entry_id_fk" FOREIGN KEY ("settles_entry_id") REFERENCES "public"."ledger_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_entry_settles_entry_idx" ON "ledger_entry" USING btree ("settles_entry_id");
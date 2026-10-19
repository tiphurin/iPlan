CREATE TYPE "public"."attachment_kind" AS ENUM('slip', 'photo', 'file');--> statement-breakpoint
CREATE TABLE "attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"trip_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"kind" "attachment_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"thumb_key" text,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachment_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_entity_idx" ON "attachment" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "attachment_trip_idx" ON "attachment" USING btree ("trip_id");
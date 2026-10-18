CREATE TABLE "trip_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"token" text NOT NULL,
	"role" "trip_role" NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"use_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "trip_invite_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "trip_invite" ADD CONSTRAINT "trip_invite_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_invite" ADD CONSTRAINT "trip_invite_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_invite_trip_idx" ON "trip_invite" USING btree ("trip_id");
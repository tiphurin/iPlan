CREATE TABLE "trip_pool_contribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"fx_rate" text NOT NULL,
	"base_amount_minor" bigint NOT NULL,
	"date" date NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip" ADD COLUMN "pool_mode" text DEFAULT 'actual' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_pool_contribution" ADD CONSTRAINT "trip_pool_contribution_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_pool_contribution" ADD CONSTRAINT "trip_pool_contribution_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_pool_contribution" ADD CONSTRAINT "trip_pool_contribution_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_pool_contribution_trip_idx" ON "trip_pool_contribution" USING btree ("trip_id");
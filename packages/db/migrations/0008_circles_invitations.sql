CREATE TYPE "public"."invitation_kind" AS ENUM('trip', 'ledger');--> statement-breakpoint
CREATE TABLE "circle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circle_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "circle_member" (
	"circle_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circle_member_circle_id_user_id_pk" PRIMARY KEY("circle_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "invitation_kind" NOT NULL,
	"target_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"invited_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "nickname" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "bootstrap_secret_hash" text;--> statement-breakpoint
ALTER TABLE "circle_member" ADD CONSTRAINT "circle_member_circle_id_circle_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_member" ADD CONSTRAINT "circle_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circle_member_user_idx" ON "circle_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_target_user_idx" ON "invitation" USING btree ("kind","target_id","user_id");--> statement-breakpoint
CREATE INDEX "invitation_user_idx" ON "invitation" USING btree ("user_id");--> statement-breakpoint
-- Trip or wallet deleted: its open invitations go too.
CREATE FUNCTION "invitation_cleanup"() RETURNS trigger AS $$
BEGIN
	DELETE FROM "invitation" WHERE "target_id" = OLD."id";
	RETURN OLD;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "trip_invitation_cleanup" AFTER DELETE ON "trip" FOR EACH ROW EXECUTE FUNCTION "invitation_cleanup"();--> statement-breakpoint
CREATE TRIGGER "ledger_invitation_cleanup" AFTER DELETE ON "ledger" FOR EACH ROW EXECUTE FUNCTION "invitation_cleanup"();

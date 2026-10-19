CREATE TABLE "user_feature" (
	"user_id" text NOT NULL,
	"feature_key" text NOT NULL,
	CONSTRAINT "user_feature_user_id_feature_key_pk" PRIMARY KEY("user_id","feature_key")
);
--> statement-breakpoint
ALTER TABLE "user_feature" ADD CONSTRAINT "user_feature_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
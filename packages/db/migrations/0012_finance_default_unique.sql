-- Merge built-in categories created twice by parallel first visits: keep the oldest,
-- point rules and transactions at it, then drop the copies.
WITH ranked AS (
	SELECT "id", first_value("id") OVER (PARTITION BY "owner_id", "name" ORDER BY "created_at", "id") AS "keep"
	FROM "finance_category" WHERE "name" LIKE 'default:%'
)
UPDATE "recurring_rule" r SET "category_id" = ranked."keep" FROM ranked WHERE r."category_id" = ranked."id" AND ranked."id" <> ranked."keep";--> statement-breakpoint
WITH ranked AS (
	SELECT "id", first_value("id") OVER (PARTITION BY "owner_id", "name" ORDER BY "created_at", "id") AS "keep"
	FROM "finance_category" WHERE "name" LIKE 'default:%'
)
UPDATE "finance_transaction" t SET "category_id" = ranked."keep" FROM ranked WHERE t."category_id" = ranked."id" AND ranked."id" <> ranked."keep";--> statement-breakpoint
WITH ranked AS (
	SELECT "id", first_value("id") OVER (PARTITION BY "owner_id", "name" ORDER BY "created_at", "id") AS "keep"
	FROM "finance_category" WHERE "name" LIKE 'default:%'
)
DELETE FROM "finance_category" c USING ranked WHERE c."id" = ranked."id" AND ranked."id" <> ranked."keep";--> statement-breakpoint
CREATE UNIQUE INDEX "finance_category_default_idx" ON "finance_category" USING btree ("owner_id","name") WHERE "finance_category"."name" like 'default:%';
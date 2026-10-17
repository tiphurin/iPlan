# @iplan/db

Drizzle ORM schema, SQL migrations and demo seed for PostgreSQL.

| File            | Purpose                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/schema.ts` | Tables: Better Auth (`user`, `session`, `account`, `verification`), trips (`trip`, `trip_member`, `trip_item`, `trip_item_check_in`), `audit_log` |
| `src/client.ts` | `createDb(url)` and the `Database` / `Executor` types repositories use                                                                            |
| `src/demo.ts`   | Fictional "Seoul (demo)" trip, built relative to today                                                                                            |
| `src/seed.ts`   | Resets the demo users and trip (idempotent)                                                                                                       |
| `migrations/`   | Generated SQL; commit every migration                                                                                                             |

Conventions: money is `bigint` minor units, instants are `timestamptz` (UTC) with an IANA zone column for display, ids are UUIDs except Better Auth's text ids.

```bash
yarn db:setup      # start Postgres in Docker, migrate, seed
yarn db:generate   # after editing schema.ts: write a new migration
yarn db:migrate    # apply migrations
yarn db:seed       # reset demo data
yarn db:studio     # browse data in Drizzle Studio
```

# Seed data

Where each kind of seed data lives and how to load it.

| Data                                                       | Where it is                                     | In git?             | Command                |
| ---------------------------------------------------------- | ----------------------------------------------- | ------------------- | ---------------------- |
| Dev-login accounts (Demo Owner, Demo Friend, New Sign-up)  | `packages/db/src/seed-base.ts`                  | yes (fictional)     | `yarn db:seed`         |
| Demo trip "Seoul (demo)" + a year of money for `/showcase` | `packages/db/src/demo.ts`, `seed-demo.ts`       | yes (fictional)     | `yarn db:seed:demo`    |
| **Your real data** (real trips, real people)               | `packages/db/seed/private/*.json`               | **no** (gitignored) | `yarn db:seed:private` |
| Groups and features (Travelers, Full access)               | migrations `0006`, `0007`                       | yes                 | `yarn db:migrate`      |
| Built-in super admin `admin`                               | created on API start from `SUPERADMIN_PASSWORD` | no (env)            | —                      |

- The format of a private file is described in `packages/db/src/private-seed.ts`.
- `yarn db:reset` wipes the local database, runs every migration and the dev-login seed.
  Then run `yarn db:seed:private` (and `yarn db:seed:demo` if you want the showcase).
- Never put real names, emails, bookings or addresses anywhere except `seed/private/`:
  the repository is public. Production data goes in through the app (trip backup → import).

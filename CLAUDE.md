# iPlan — project memory for Claude Code

## What this is

iPlan: a mobile-first web app for (1) planning trips and splitting trip costs between members, and (2) tracking personal monthly finances (income, tax deductions, fixed costs, one-off expenses, slips). It grows out of a single-file prototype in `legacy/seoul-trip.html` (a Seoul trip planner, 22–27 Oct 2026; local only, gitignored because it holds real bookings). Full background: `docs/HANDOFF.md`. Accounts and secrets: `docs/INFRA.md`.

## Owner preferences (must follow)

- Talk to the owner in Thai. Code, commits, identifiers in English.
- Explain the plan and get approval BEFORE writing code. Use plan mode for anything non-trivial.
- Work on a feature branch off the latest `feature/iPlan/main` and open a Pull Request into `feature/iPlan/main` at https://github.com/tiphurin/iPlan — never push to `main`. One focused commit per PR; don't stack open PRs (keep follow-up work local until the previous PR merges, then rebase it).
- Everything must run on free tiers **without a credit card on file**. Flag any step that would need a card or paid plan before doing it.
- The repo is public: never commit personal data (booking references, seats, real names in seed data, addresses of private appointments).
- Money is shown in the original currency plus a THB conversion where relevant.
- Mobile UX first (iPhone, Safari): tap targets ≥ 44px, bottom navigation, safe areas, dark mode.
- UI in Thai (default) and English.

## Architecture (approved 17 Oct 2026)

- Turborepo + Yarn 1.22 (classic) workspaces monorepo, same Yarn the owner uses in other projects; never enable Corepack or change the global Yarn, TypeScript strict everywhere (TS 6.0.x until typescript-eslint supports 7).
- `apps/web`: Next.js App Router. Server Components for reads (BFF only, no business logic), Client Components for interaction (TanStack Query, plain forms validated by the API's Zod contracts). Tailwind v4 with small shadcn-style components in `components/ui`. Charts are plain SVG. next-intl (th/en). PWA manifest.
- `apps/api`: Hono, mounted into Next.js at `/api/*` (same origin, one Vercel deployment) but never imports from Next. Per module: `<m>.routes.ts` (Zod + OpenAPI) → `<m>.service.ts` (business logic + authorization) → `<m>.repository.ts` (Drizzle only) with `<m>.mapper.ts` converting DB row ↔ domain ↔ DTO. Better Auth (Google + admin plugin + dev-only login locally). API returns error codes; the web translates them.
- Storage behind a `StorageProvider` interface: local disk (`.data/uploads`) in development, S3 API (Backblaze B2) in production. Uploads go through the API (type sniffed from bytes, 5 MB max); downloads are permission-checked (B2: 5-minute signed URL). DB stores object keys, never full URLs. Images are resized to WebP in the browser before upload (slips 2000px/q0.85, photos 1600px/q0.80, thumbnails 400px), EXIF stripped.
- Roles: `superadmin` (built-in `admin` account, password from `SUPERADMIN_PASSWORD`, must change at first login; appoints admins, can view and edit all data), `admin` (approvals, groups, circles, read-only view of anyone's data, audited), `user`. Circles decide who can find whom for invitations (trips, shared wallets); invitations must be accepted. Emails via Gmail SMTP behind `EmailProvider` (logged when SMTP is unset).
- Access: Google sign-in → account `pending` until an admin approves it; admins put users into groups, groups grant feature keys (`trips`, `finance`, `shared`). The API gates each feature's paths (`FEATURE_PATHS` in `apps/api/src/app.ts`); the web builds tabs and the dashboard from `/api/me` features and `apps/web/features/`. `ADMIN_EMAILS` bootstraps the first admin.
- Layout: phones get bottom tabs [Home, features…, Profile]; from `md` a left sidebar and multi-column pages. Design tokens and fonts (Bai Jamjuree + IBM Plex Sans Thai) follow the legacy prototype.
- Real personal data only via gitignored `packages/db/seed/private/*.json` (`yarn db:seed:private`); `yarn db:reset` wipes the local DB.
- `packages/core` pure domain logic (money in minor units, split/settle, monthly budget with overrides, schedule progress/delay) with Vitest.
- `packages/db` Drizzle schema + migrations + seed. `packages/contracts` shared Zod schemas. `packages/i18n` locales + Intl formatters. `packages/config` shared lint/tsconfig.
- Local: docker compose (Postgres), dev-only login, `yarn db:seed` demo data, `/showcase` route linking every feature.
- Hosting: Vercel Hobby (web + api), Neon (Postgres), Backblaze B2 (files), Google Cloud (OAuth client only). No Cloudflare.
- Exports: Excel via write-excel-file in the browser (loaded on demand); PDF via print-friendly pages under `/print` (correct Thai rendering); CSV, JSON backup (`iplan.trip` v1), .ics.
- Dates, times and money are formatted from fixed tables in `packages/i18n`, never `Intl`, so server and browser render identical Thai text.

## Engineering rules

- Conventional Commits, small PRs, CI must pass (format, lint, typecheck, test, build).
- Money: integer minor units (`bigint` in DB), store FX rate at time of spend.
- Time: `timestamptz` UTC + per-item IANA tz for display.
- Authorization in the API service layer; DB credentials never reach the browser.
- Dependencies: stable major lines (Node 22 LTS) and exact versions published at least 30 days ago; check the publish date (`npm view <pkg> time`) before adding or upgrading one, since Yarn 1 has no age gate.
- No secrets in git. `.env.example` documents every variable.
- README must cover: stack, project structure, architecture diagram (Mermaid), local run, deploy, free-tier notes.

# iPlan — project memory for Claude Code

## What this is

iPlan: a mobile-first web app for (1) planning trips and splitting trip costs between members, and (2) tracking personal monthly finances (income, tax deductions, fixed costs, one-off expenses, slips). It grows out of a single-file prototype in `legacy/seoul-trip.html` (a Seoul trip planner, 22–27 Oct 2026; local only, gitignored because it holds real bookings). Full background: `docs/HANDOFF.md`. Accounts and secrets: `docs/INFRA.md`.

## Owner preferences (must follow)

- Talk to the owner in Thai. Code, commits, identifiers in English.
- Explain the plan and get approval BEFORE writing code. Use plan mode for anything non-trivial.
- Work on a feature branch off `develop` and open a Pull Request into `develop` at https://github.com/tiphurin/iPlan — never push to `main`.
- Everything must run on free tiers **without a credit card on file**. Flag any step that would need a card or paid plan before doing it.
- The repo is public: never commit personal data (booking references, seats, real names in seed data, addresses of private appointments).
- Money is shown in the original currency plus a THB conversion where relevant.
- Mobile UX first (iPhone, Safari): tap targets ≥ 44px, bottom navigation, safe areas, dark mode.
- UI in Thai (default) and English.

## Architecture (approved 17 Oct 2026)

- Turborepo + Yarn 4 workspaces monorepo (`nodeLinker: node-modules`), TypeScript strict everywhere (TS 6.0.x until typescript-eslint supports 7).
- `apps/web`: Next.js App Router. Server Components for reads (BFF only, no business logic), Client Components for interaction (TanStack Query, React Hook Form + Zod). Tailwind v4 + shadcn/ui. Recharts lazy-loaded. next-intl (th/en). PWA manifest.
- `apps/api`: Hono, mounted into Next.js at `/api/*` (same origin, one Vercel deployment) but never imports from Next. Per module: `<m>.routes.ts` (Zod + OpenAPI) → `<m>.service.ts` (business logic + authorization) → `<m>.repository.ts` (Drizzle only) with `<m>.mapper.ts` converting DB row ↔ domain ↔ DTO. Better Auth (Google + admin plugin + dev-only login locally). API returns error codes; the web translates them.
- Storage behind a `StorageProvider` interface (S3 API): MinIO locally, Backblaze B2 in production. DB stores object keys, never full URLs. Images are resized to WebP in the browser before upload (slips 2000px/q0.85, photos 1600px/q0.80, thumbnails 400px), EXIF stripped.
- `packages/core` pure domain logic (money in minor units, split/settle, monthly budget with overrides, schedule progress/delay) with Vitest.
- `packages/db` Drizzle schema + migrations + seed. `packages/contracts` shared Zod schemas. `packages/i18n` locales + Intl formatters. `packages/config` shared lint/tsconfig.
- Local: docker compose (Postgres + MinIO), dev-only login, `yarn db:seed` demo data, `/showcase` route demoing every feature.
- Hosting: Vercel Hobby (web + api), Neon (Postgres), Backblaze B2 (files), Google Cloud (OAuth client only). No Cloudflare.
- Exports: Excel via exceljs in the browser; PDF via print-friendly pages (correct Thai rendering); CSV, JSON backup, .ics.

## Engineering rules

- Conventional Commits, small PRs, CI must pass (format, lint, typecheck, test, build).
- Money: integer minor units (`bigint` in DB), store FX rate at time of spend.
- Time: `timestamptz` UTC + per-item IANA tz for display.
- Authorization in the API service layer; DB credentials never reach the browser.
- No secrets in git. `.env.example` documents every variable.
- README must cover: stack, project structure, architecture diagram (Mermaid), local run, deploy, free-tier notes.

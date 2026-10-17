# iPlan

A mobile-first web app for **planning trips** with friends (itinerary across time zones, live "today" view, checklists, shared expenses and who-owes-whom) and **tracking monthly money** (salary, deductions, fixed costs, one-off spending, slips, budgets and charts).

> Status: early development. This README grows with each Pull Request; sections marked _(planned)_ land in later PRs.

## Stack

| Layer    | Choice                                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Monorepo | Turborepo + Yarn 4 workspaces, TypeScript strict                                                                              |
| Web      | Next.js (App Router), Tailwind CSS v4, shadcn/ui, TanStack Query, React Hook Form + Zod, Recharts, next-intl (Thai / English) |
| API      | Hono with Zod + OpenAPI, Better Auth (Google sign-in, admin roles)                                                            |
| Data     | PostgreSQL with Drizzle ORM                                                                                                   |
| Files    | Any S3-compatible storage (MinIO locally, Backblaze B2 in production)                                                         |
| Tests    | Vitest; Playwright smoke tests _(planned)_                                                                                    |
| Hosting  | Vercel Hobby (web + API), Neon (Postgres), Backblaze B2 (files): all free, no card                                            |

## Project structure

```
iPlan/
├─ apps/
│  ├─ web/          Next.js UI; mounts the API at /api/*           (planned)
│  └─ api/          Hono app: modules/<m>/{routes,service,repository,mapper} (planned)
├─ packages/
│  ├─ config/       Shared tsconfig and ESLint config
│  ├─ core/         Pure domain logic: money, split, budget, schedule  (planned)
│  ├─ db/           Drizzle schema, migrations, seed                    (planned)
│  ├─ contracts/    Zod request/response schemas shared by web and API  (planned)
│  └─ i18n/         Locales and Intl formatters                         (planned)
├─ docs/            HANDOFF.md (background), INFRA.md (accounts, secrets)
└─ .github/workflows/ci.yml
```

## Architecture

```mermaid
flowchart TB
  B[iPhone Safari / PWA] -->|same origin, cookie session| V
  subgraph V[Vercel Hobby: one deployment]
    subgraph W[apps/web: Next.js]
      CC[Client Components<br/>forms, charts, timers<br/>TanStack Query]
      SC[Server Components<br/>SSR / BFF reads]
    end
    subgraph A[apps/api: Hono mounted at /api]
      R[routes<br/>Zod + OpenAPI] --> S[service<br/>business rules + authorization]
      S --> RP[repository<br/>Drizzle only]
      S --> M[mapper<br/>row ↔ domain ↔ DTO]
      AU[Better Auth<br/>Google + admin]
    end
    CC -->|fetch /api/*| R
    SC -->|in-process request| R
  end
  S --> CORE[[packages/core<br/>money, split, budget, schedule]]
  RP --> PG[(Postgres: Neon)]
  S -->|presigned URL| OS[(Object storage: Backblaze B2)]
  B -. direct upload, resized WebP .-> OS
  AU --> G[Google OAuth]
```

Why this shape:

- **Clear layers without extra servers.** The API is its own package and never imports Next.js, but it runs inside the same Vercel deployment. Web and API share one origin, so the session cookie is first-party. iPhone Safari blocks third-party cookies, which would break login if the API sat on a different free domain.
- **Business rules live in one place.** Routes validate, services decide (including who may do what), repositories only query, mappers only convert. Pure calculations sit in `packages/core` and are unit-tested.
- **Money is exact.** Amounts are integer minor units (`bigint`), each expense stores the FX rate used, and the UI shows the original currency plus THB.
- **Storage is swappable.** Code talks to an S3-compatible interface and the database stores object keys, so moving providers means copying files and changing environment variables.

## Run locally

Requirements: Node 22 (`.nvmrc`), Yarn via Corepack, Docker (Docker Desktop, OrbStack or Colima).

```bash
corepack enable
yarn install
cp .env.example .env
yarn check          # format, lint, typecheck, test, build
```

Database, API and web app commands (`docker compose up -d`, `yarn db:setup`, `yarn dev`) arrive with the PRs that add them.

## Scripts

| Command                             | What it does                    |
| ----------------------------------- | ------------------------------- |
| `yarn dev`                          | Run every app in watch mode     |
| `yarn build`                        | Build all packages and apps     |
| `yarn lint`                         | ESLint in every package         |
| `yarn typecheck`                    | `tsc --noEmit` in every package |
| `yarn test`                         | Vitest in every package         |
| `yarn format` / `yarn format:check` | Prettier write / check          |
| `yarn check`                        | Everything CI runs              |

## Deploy _(planned)_

Vercel builds the Next.js app (which includes the API), Neon provides Postgres, Backblaze B2 stores files. Step-by-step setup and every environment variable are in [docs/INFRA.md](docs/INFRA.md).

## Free-tier notes

- No service has a card on file, so nothing can be billed; over-quota services pause or throttle instead.
- Vercel Hobby is for personal, non-commercial use.
- Neon scales to zero when idle; the first request after a pause takes about a second longer.
- Backblaze B2 gives 10 GB. Photos are resized in the browser before upload (about 150–400 KB each), which fits tens of thousands of images.

## Contributing

- Branch off `develop`, open a Pull Request into `develop`. Nothing is pushed to `main` directly.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:` ...).
- CI must be green: format, lint, typecheck, test, build.
- Never commit secrets or personal data; this repository is public.

## License

[MIT](LICENSE)

# @iplan/api

The HTTP API, built with Hono and mounted inside Next.js at `/api` (same origin as the web app, so the session cookie is first-party on iPhone Safari). It never imports Next.js and can run on its own.

## Layout

```
src/
├─ app.ts                 createApp(deps): middleware, error handling, routes, OpenAPI
├─ index.ts               buildApp() wires real dependencies from env; getApp() singleton
├─ env.ts                 typed environment variables
├─ infra/
│  ├─ auth.ts             Better Auth (Google, admin plugin, dev-only password login)
│  └─ dev-login.ts        one-tap sign-in as a seeded demo user (never in production)
├─ shared/                errors (AppError → ErrorResponse), auth guards, audit log, router factory
└─ modules/<module>/
   ├─ <module>.routes.ts      HTTP only: validate with Zod contracts, call the service
   ├─ <module>.service.ts     business rules and authorization
   ├─ <module>.repository.ts  Drizzle queries only
   ├─ <module>.mapper.ts      DB row → DTO
   └─ <module>.service.test.ts  tests with an in-memory repository
```

`modules/me` is the reference module; copy its shape for new ones.

## Endpoints so far

| Method      | Path                             |                                                                                             |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| GET         | `/api/health`                    | Liveness                                                                                    |
| GET/POST    | `/api/auth/*`                    | Better Auth (sign in with Google, session, sign out)                                        |
| POST        | `/api/dev/login`                 | Dev login as `dev@iplan.local` or `friend@iplan.local` (only when `DEV_LOGIN_ENABLED=true`) |
| GET / PATCH | `/api/me`                        | Current user; change name or language                                                       |
| GET         | `/api/openapi.json`, `/api/docs` | OpenAPI document and interactive reference                                                  |

Errors always look like `{ "error": { "code": "VALIDATION_FAILED", "message": "...", "fields": { "locale": "..." } } }`; the web app translates `code`.

## Run on its own

```bash
yarn db:setup
yarn workspace @iplan/api dev:standalone   # http://localhost:4000/api/docs
```

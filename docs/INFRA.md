# Infrastructure and accounts

Every service iPlan uses is on a free tier **with no credit card on file**. Without a card, going over a quota pauses or limits the service; it can never create a bill.

> Quotas below were checked in October 2026. Re-check each pricing page before signing up (the deploy PR does this).

## When each account is needed

| Service              | Purpose                            | Free tier                                      | Card? | Needed from                                                       | Sign up with              |
| -------------------- | ---------------------------------- | ---------------------------------------------- | ----- | ----------------------------------------------------------------- | ------------------------- |
| GitHub               | Code, Pull Requests, CI            | Actions unlimited on public repos              | No    | Now                                                               | (existing)                |
| Google Cloud Console | "Sign in with Google" OAuth client | OAuth is free; no billing account needed       | No    | Optional locally (dev login works without it), required at deploy | Personal Google account   |
| Vercel               | Hosts web + API (one deployment)   | Hobby: personal, non-commercial                | No    | Deploy                                                            | Continue with GitHub      |
| Neon                 | Postgres                           | Free: ~0.5 GB, scales to zero when idle        | No    | Deploy                                                            | Continue with GitHub      |
| Backblaze B2         | Slips and photos (S3 API)          | 10 GB storage, 1 GB download/day, never pauses | No    | Deploy                                                            | Personal email + password |

**Not used:** Cloudflare (R2 needs a card), Supabase, Firebase Storage (needs the Blaze plan since Feb 2026), a custom domain (costs money; `*.vercel.app` is used instead).

Local development needs **no accounts**: Postgres and MinIO run in Docker and the app has a dev-only login.

## Traps to avoid when signing up

- **Google Cloud:** do **not** click "Start free trial" / "Activate full account"; that asks for a card. Create a project, configure the OAuth consent screen (External, scopes `email` and `profile`), then create an OAuth client of type _Web application_. No billing account is needed.
- **Vercel / Neon:** stay on Hobby / Free; skip every "Upgrade" or "Start trial" prompt.
- **Backblaze B2:** only sign up for **B2 Cloud Storage** (not "Computer Backup", which is a paid product). Keep the default data caps.

## Where things live

```
GitHub (owner) ──┬─ Vercel  ── project "iplan"            (login with GitHub)
                 └─ Neon    ── project "iplan" ── branch main / dev  (login with GitHub)
Personal email ──── Backblaze B2 ── bucket "iplan-attachments" (private)
Google account ──── Google Cloud project "iplan" ── OAuth client (Web)
```

- Use the name `iplan` everywhere.
- Region: Neon `AWS ap-southeast-1 (Singapore)`; Vercel function region `sin1`. B2 has no Asian region, so choose `us-west`; images are cached by the browser and lists use small thumbnails.
- Turn on 2FA for GitHub, Google and Backblaze.

## Secrets: three places only

| Place                                                      | Holds                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `.env` on your machine (gitignored)                        | Local values; copy from `.env.example`                            |
| Vercel → Project → Settings → Environment Variables        | All production and preview values                                 |
| GitHub → Repo → Settings → Secrets and variables → Actions | Only if CI ever needs to reach a real service (not needed so far) |

Never commit a secret. `.env.example` lists every variable with a note on where its production value comes from.

### Environment variables

| Variable                                    | Local value                        | Production value from                                |
| ------------------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`                              | Docker Postgres                    | Neon → Connection details → pooled connection string |
| `BETTER_AUTH_SECRET`                        | 32+ characters                     | `openssl rand -base64 32`                            |
| `BETTER_AUTH_URL`                           | `http://localhost:3000`            | `https://<project>.vercel.app`                       |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional                           | Google Cloud → Credentials → OAuth client            |
| `DEV_LOGIN_ENABLED`                         | `true`                             | `false`                                              |
| `STORAGE_DRIVER`                            | `local` (files in `.data/uploads`) | `s3`                                                 |
| `S3_ENDPOINT`                               | `http://localhost:9000`            | B2 bucket page → Endpoint (prefix `https://`)        |
| `S3_REGION`                                 | `us-east-1`                        | Region part of the B2 endpoint, e.g. `us-west-004`   |
| `S3_BUCKET`                                 | `iplan-attachments`                | `iplan-attachments`                                  |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | MinIO credentials                  | B2 → Application Keys (restricted to the one bucket) |
| `S3_FORCE_PATH_STYLE`                       | `true`                             | `false`                                              |

Google OAuth redirect URIs to register: `http://localhost:3000/api/auth/callback/google` and `https://<project>.vercel.app/api/auth/callback/google`.

## Keeping an eye on usage

| Dashboard                  | What to check                                             |
| -------------------------- | --------------------------------------------------------- |
| Vercel → Usage             | Function invocations, bandwidth; preview link per PR      |
| Neon → Monitoring          | Storage size, compute hours                               |
| Backblaze → Caps & Alerts  | Storage used, daily downloads; email alerts at 75% / 100% |
| iPlan admin page (planned) | Users, trips, storage used vs 10 GB, DB size, audit log   |

A weekly GitHub Actions job (added with the deploy PR) will ping the app so you get an email from GitHub if it is down.

## Backups

- Neon free keeps a short point-in-time restore window.
- The app's JSON backup/export lets you download your data any time.

## Rotating a secret

1. Create the new value in the provider (new B2 application key, new Google client secret, or a new `BETTER_AUTH_SECRET`).
2. Update it in Vercel → Environment Variables, then redeploy.
3. Delete the old key in the provider. Rotating `BETTER_AUTH_SECRET` signs everyone out.

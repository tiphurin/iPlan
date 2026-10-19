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
| `ADMIN_EMAILS`                              | optional                           | Your Google email (comma-separated for several)      |
| `SUPERADMIN_PASSWORD`                       | `1234`                             | First password of the built-in `admin` account       |
| `SMTP_USER` / `SMTP_PASSWORD`               | empty (emails go to the log)       | Gmail address / Gmail **App password**               |
| `MAIL_FROM`                                 | optional                           | e.g. `iPlan <you@gmail.com>`                         |
| `DEV_LOGIN_ENABLED`                         | `true`                             | `false`                                              |
| `STORAGE_DRIVER`                            | `local` (files in `.data/uploads`) | `s3`                                                 |
| `S3_ENDPOINT`                               | `http://localhost:9000`            | B2 bucket page → Endpoint (prefix `https://`)        |
| `S3_REGION`                                 | `us-east-1`                        | Region part of the B2 endpoint, e.g. `us-west-004`   |
| `S3_BUCKET`                                 | `iplan-attachments`                | `iplan-attachments`                                  |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | MinIO credentials                  | B2 → Application Keys (restricted to the one bucket) |
| `S3_FORCE_PATH_STYLE`                       | `true`                             | `false`                                              |

Google OAuth redirect URIs to register: `http://localhost:3000/api/auth/callback/google` and `https://<project>.vercel.app/api/auth/callback/google`.

## Deploy checklist (first time)

Do these in order; each step only needs the previous ones. Nothing here asks for a card; if a screen does, you've hit an upgrade prompt, so go back.

1. **Neon** (Continue with GitHub)
   1. Create project `iplan`, Postgres 17, region **AWS Asia Pacific (Singapore)**.
   2. Copy the **pooled** connection string (host contains `-pooler`, ends with `?sslmode=require`). This is `DATABASE_URL`.
   3. Optional: create a branch `preview` and copy its pooled string for preview deployments.
2. **Backblaze B2** (email sign-up, B2 Cloud Storage only)
   1. Buckets → Create bucket `iplan-attachments`, **Private**, default encryption on.
   2. Note the bucket's **Endpoint** (e.g. `s3.us-west-004.backblazeb2.com`).
   3. Application Keys → Add a key **restricted to `iplan-attachments`**, read and write. Copy keyID and applicationKey (shown once).
3. **Google Cloud Console** (personal Google account, no billing)
   1. Create project `iplan`.
   2. APIs & Services → OAuth consent screen: External, app name iPlan, scopes `email` and `profile`, add yourself as a test user (or publish; basic scopes need no review).
   3. Credentials → Create OAuth client ID → Web application. Redirect URI: `https://<project>.vercel.app/api/auth/callback/google` (add `http://localhost:3000/api/auth/callback/google` for local testing). Copy client ID and secret.
4. **Vercel** (Continue with GitHub, Hobby)
   1. Add New → Project → import `tiphurin/iPlan`. **Root Directory: `apps/web`**. Framework: Next.js. `apps/web/vercel.json` sets the install and build commands and the Singapore region.
   2. Settings → Git → Production Branch: the branch you deploy from (e.g. `main` once merged there).
   3. Settings → Environment Variables, for **Production** (and Preview, pointing `DATABASE_URL` at the Neon `preview` branch):

      | Variable                                    | Value                                           |
      | ------------------------------------------- | ----------------------------------------------- |
      | `DATABASE_URL`                              | Neon pooled connection string                   |
      | `BETTER_AUTH_SECRET`                        | output of `openssl rand -base64 32`             |
      | `BETTER_AUTH_URL`                           | `https://<project>.vercel.app`                  |
      | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 3                                     |
      | `ADMIN_EMAILS`                              | your Google email, e.g. `you@gmail.com`         |
      | `SUPERADMIN_PASSWORD`                       | a first password for `admin` (changed at login) |
      | `SMTP_USER` / `SMTP_PASSWORD`               | Gmail address / Gmail App password              |
      | `DEV_LOGIN_ENABLED`                         | `false`                                         |
      | `STORAGE_DRIVER`                            | `s3`                                            |
      | `S3_ENDPOINT`                               | `https://` + the B2 endpoint                    |
      | `S3_REGION`                                 | region part of the endpoint, e.g. `us-west-004` |
      | `S3_BUCKET`                                 | `iplan-attachments`                             |
      | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | B2 keyID / applicationKey                       |
      | `S3_FORCE_PATH_STYLE`                       | `false`                                         |

   4. Deploy. Production builds run `yarn db:migrate` first (`scripts/vercel-build.sh`); preview builds never migrate.
5. **Gmail for notification emails** (free, 500/day, no card)
   1. Google account → Security → turn on **2-Step Verification**.
   2. Security → **App passwords** → create one named `iplan`. Copy the 16 letters into `SMTP_PASSWORD`; your Gmail address goes into `SMTP_USER`.
   3. Without these, iPlan works but only prints emails to the Vercel log.
6. **First sign-in, admin and approvals**
   1. Open `https://<project>.vercel.app` → **Admin sign-in** → username `admin` and the `SUPERADMIN_PASSWORD` value. You must choose a new password straight away (later: Profile → Change password). Forgot it? Set a new `SUPERADMIN_PASSWORD` in Vercel and redeploy; that resets it.
   2. Or sign in with the Google account listed in `ADMIN_EMAILS`; it becomes an (ordinary) admin straight away.
   3. Everyone else who signs in with Google lands on a "waiting for approval" screen and cannot read or change anything.
   4. Approve them in **Admin → Approvals**: pick their groups (e.g. _Travelers_ = trips only, _Full access_ = trips + personal money + shared money), then **Approve**. **Reject** suspends the account.
   5. **Admin → Circles**: put people who should find each other (family, a trip group) in the same circle; only then can they invite each other.
   6. **Admin → Groups** creates groups and ticks which features each one turns on; **Admin → Users** changes groups later, makes someone an admin, or suspends them.
   7. Bring your real data over: export the trip from your local app (trip → backup JSON) and import it in production; nothing personal goes through git.
7. **Uptime ping** (optional): GitHub → repo Settings → Secrets and variables → Actions → Variables → `APP_URL` = `https://<project>.vercel.app`. The weekly `Uptime` workflow then emails you if `/api/health` fails.

The app refuses to start in production if `DEV_LOGIN_ENABLED` is true or `STORAGE_DRIVER` is not `s3`, so a missing setting shows up immediately in the Vercel logs.

## Keeping an eye on usage

| Dashboard                  | What to check                                             |
| -------------------------- | --------------------------------------------------------- |
| Vercel → Usage             | Function invocations, bandwidth; preview link per PR      |
| Neon → Monitoring          | Storage size, compute hours                               |
| Backblaze → Caps & Alerts  | Storage used, daily downloads; email alerts at 75% / 100% |
| iPlan admin page (planned) | Users, trips, storage used vs 10 GB, DB size, audit log   |

The weekly `Uptime` workflow pings `/api/health` once `APP_URL` is set; GitHub emails you if it fails.

## Backups

- Neon free keeps a short point-in-time restore window.
- The app's JSON backup/export lets you download your data any time.

## Rotating a secret

1. Create the new value in the provider (new B2 application key, new Google client secret, or a new `BETTER_AUTH_SECRET`).
2. Update it in Vercel → Environment Variables, then redeploy.
3. Delete the old key in the provider. Rotating `BETTER_AUTH_SECRET` signs everyone out.

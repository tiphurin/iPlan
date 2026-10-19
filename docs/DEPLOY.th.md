# คู่มือ Deploy iPlan ขึ้น public URL (ภาษาไทย ทีละขั้น)

คู่มือนี้พาเอา iPlan ขึ้นเว็บจริงที่เปิดจากมือถือได้ทุกที่ โดยใช้บริการฟรีทั้งหมด **ไม่ต้องผูกบัตรเครดิต**
ถ้าหน้าไหนขอบัตร แปลว่ากดเข้าไปหน้าอัปเกรดแล้ว ให้ย้อนกลับ

ฉบับภาษาอังกฤษที่สั้นกว่า: [DEPLOY.md](DEPLOY.md) และรายละเอียดบัญชี/โควตา: [INFRA.md](INFRA.md)

## ภาพรวม

```mermaid
flowchart LR
  U[มือถือ / คอม] -->|https://iplan-xxx.vercel.app| V[Vercel<br/>เว็บ + API]
  V -->|DATABASE_URL| N[(Neon<br/>Postgres)]
  V -->|S3 API| B[(Backblaze B2<br/>รูป/สลิป)]
  V -->|OAuth| G[Google<br/>Sign in]
  V -->|SMTP| M[Gmail<br/>ส่งอีเมล]
  GH[GitHub tag v0.1.0] -->|Release workflow| V
```

| ส่วน                         | บริการ                          | ฟรีแค่ไหน             | ใช้ทำอะไร                                  |
| ---------------------------- | ------------------------------- | --------------------- | ------------------------------------------ |
| เว็บ + API (server/host)     | **Vercel Hobby**                | ใช้ส่วนตัวได้ฟรี      | รันแอป ได้ URL `https://<ชื่อ>.vercel.app` |
| ฐานข้อมูล (db)               | **Neon Free**                   | 0.5 GB                | Postgres เก็บทริป เงิน ผู้ใช้              |
| ไฟล์ (รูปปก สลิป รูปโปรไฟล์) | **Backblaze B2**                | 10 GB                 | เก็บไฟล์แบบ private                        |
| เข้าสู่ระบบ                  | **Google Cloud** (OAuth client) | ฟรี                   | ปุ่ม "เข้าสู่ระบบด้วย Google"              |
| ส่งอีเมลแจ้งเตือน            | **Gmail** App password          | 500 ฉบับ/วัน          | แจ้ง admin เมื่อมีคนสมัคร, คำเชิญ          |
| ปล่อยเวอร์ชัน                | **GitHub Actions**              | ฟรีสำหรับ repo public | ติด tag แล้ว deploy ให้เอง                 |

เวลาที่ใช้ครั้งแรก: ประมาณ 45–60 นาที ครั้งต่อไปแค่ติด tag (1 นาที + รอ ~5 นาที)

---

## ขั้นที่ 0 — ก่อนเริ่ม

1. Merge PR ที่ค้างอยู่เข้า `feature/iPlan/main` ให้หมด แล้วในเครื่อง:
   ```bash
   git switch feature/iPlan/main
   git pull
   yarn install --frozen-lockfile
   yarn validate          # ต้องผ่านทั้งหมด
   ```
2. **เรื่องข้อมูลส่วนตัว**: repo นี้เป็น public ไฟล์ `legacy/seoul-trip.html` (มีข้อมูลการจองจริง) เคยหลุดเข้า history ของ git
   ตัดสินใจก่อน deploy: ปรับ repo เป็น private (GitHub → Settings → General → Danger Zone → Change visibility) หรือให้ช่วยลบออกจาก history
   _หมายเหตุ: ถ้าเป็น private, GitHub Actions ยังฟรี 2,000 นาที/เดือน พอใช้สบาย_
3. เปิดโปรแกรมจดค่าไว้ 1 ไฟล์ (ห้ามเก็บใน repo) สำหรับจดค่าลับระหว่างทำ เช่น connection string, key, password

---

## ขั้นที่ 1 — สมัครบริการ (ทำตามลำดับ)

### 1.1 Neon (ฐานข้อมูล)

1. ไปที่ <https://neon.tech> → **Sign up** → **Continue with GitHub**
2. สร้างโปรเจกต์:
   - Project name: `iplan`
   - Postgres version: 17
   - Region: **AWS Asia Pacific (Singapore)** (ใกล้ไทยที่สุด และตรงกับ Vercel `sin1`)
3. หน้า Dashboard → **Connect** → เลือก **Pooled connection** → คัดลอก connection string
   หน้าตาประมาณ `postgresql://iplan_owner:xxxx@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/iplan?sslmode=require`
   ต้องมีคำว่า **`-pooler`** และลงท้าย **`sslmode=require`**
4. จดไว้เป็น **`DATABASE_URL`**

### 1.2 Backblaze B2 (เก็บไฟล์)

1. ไปที่ <https://www.backblaze.com/sign-up/cloud-storage> → สมัครด้วยอีเมล (เลือก **B2 Cloud Storage**) → ยืนยันอีเมล
2. **Buckets → Create a Bucket**
   - Bucket name: `iplan-attachments` (ถ้าชื่อซ้ำ ให้เติมท้าย เช่น `iplan-attachments-tp` แล้วใช้ชื่อนี้แทนทุกที่)
   - Files in Bucket are: **Private**
   - Default Encryption: **Enable**
3. เปิดหน้า bucket ดู **Endpoint** เช่น `s3.us-west-004.backblazeb2.com`
   - `S3_ENDPOINT` = `https://s3.us-west-004.backblazeb2.com`
   - `S3_REGION` = ส่วนกลาง เช่น `us-west-004`
4. **Application Keys → Add a New Application Key**
   - Name: `iplan`
   - Allow access to Bucket(s): **เฉพาะ `iplan-attachments`**
   - Type of Access: **Read and Write**
   - กด Create → **คัดลอกทันที** (โชว์ครั้งเดียว): `keyID` = `S3_ACCESS_KEY_ID`, `applicationKey` = `S3_SECRET_ACCESS_KEY`

### 1.3 Gmail App password (ส่งอีเมล)

1. บัญชี Google ที่จะใช้ส่ง → <https://myaccount.google.com/security> → เปิด **2-Step Verification**
2. <https://myaccount.google.com/apppasswords> → ตั้งชื่อ `iplan` → **Create**
3. คัดลอกรหัส 16 ตัว (ไม่ต้องมีช่องว่าง) = `SMTP_PASSWORD`, อีเมล Gmail = `SMTP_USER`
   _ข้ามขั้นนี้ได้ ระบบยังใช้งานได้ แค่อีเมลจะไปอยู่ใน log ของ Vercel แทนการส่งจริง_

### 1.4 Vercel (host) — สร้างโปรเจกต์เพื่อให้ได้ URL ก่อน

1. ไปที่ <https://vercel.com/signup> → **Hobby** → **Continue with GitHub**
2. **Add New… → Project** → **Import** `tiphurin/iPlan` (ถ้าไม่เห็น ให้กด Adjust GitHub App Permissions แล้วอนุญาต repo นี้)
3. ตั้งค่าหน้า Configure:
   - Project Name: `iplan` (ชื่อนี้จะเป็น URL)
   - Framework Preset: **Next.js**
   - **Root Directory: `apps/web`** ← สำคัญ
   - ยังไม่ต้องใส่ Environment Variables ตอนนี้
4. กด **Deploy** ได้เลย รอบแรกอาจ **build ไม่ผ่าน** (ยังไม่มี env) หรือถูกข้าม (repo ตั้งให้ deploy production จาก tag เท่านั้น) — ไม่เป็นไร จุดประสงค์คือให้ได้โปรเจกต์และ URL
5. Project → **Settings → Domains** ดู production domain เช่น `iplan-tiphurin.vercel.app`
   จดไว้: **`APP_URL` = `https://iplan-tiphurin.vercel.app`** (ใช้ชื่อจริงที่เห็น)

### 1.5 Google Cloud (ปุ่ม Sign in with Google)

1. <https://console.cloud.google.com> (บัญชี Google ส่วนตัว **ไม่ต้องเปิด billing**) → สร้างโปรเจกต์ `iplan`
2. **APIs & Services → OAuth consent screen** (หรือ Google Auth Platform → Branding)
   - User type: **External**, App name: `iPlan`, ใส่อีเมลติดต่อ
   - Scopes: `openid`, `email`, `profile` (ไม่ต้องขอ scope อื่น)
   - Audience: กด **Publish app** (scope พื้นฐานไม่ต้องรอ Google ตรวจ) — ถ้าค้างไว้ที่ Testing ต้องเพิ่มอีเมลทุกคนเป็น test user
3. **Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**, Name: `iplan`
   - Authorized redirect URIs:
     - `https://iplan-tiphurin.vercel.app/api/auth/callback/google` (ใช้ URL จากขั้น 1.4)
     - `http://localhost:3000/api/auth/callback/google` (สำหรับทดสอบในเครื่อง)
   - Create → คัดลอก **Client ID** = `GOOGLE_CLIENT_ID`, **Client secret** = `GOOGLE_CLIENT_SECRET`

---

## ขั้นที่ 2 — ใส่ค่าลับใน Vercel

Vercel → Project → **Settings → Environment Variables** → ใส่ทีละตัว เลือก Environment **Production** (และ Preview ถ้าต้องการ)

| ชื่อ                                        | ค่า                                                             | มาจาก      |
| ------------------------------------------- | --------------------------------------------------------------- | ---------- |
| `DATABASE_URL`                              | pooled connection string                                        | 1.1        |
| `BETTER_AUTH_SECRET`                        | สุ่มใหม่ ยาว ≥ 32 ตัว: รัน `openssl rand -base64 32`            | เครื่องคุณ |
| `BETTER_AUTH_URL`                           | `https://iplan-tiphurin.vercel.app`                             | 1.4        |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |                                                                 | 1.5        |
| `ADMIN_EMAILS`                              | อีเมล Google ของคุณ (หลายคนคั่นด้วย `,`)                        |            |
| `SUPERADMIN_PASSWORD`                       | รหัสเริ่มต้นของบัญชี `admin` (ระบบบังคับเปลี่ยนตอนเข้าครั้งแรก) | ตั้งเอง    |
| `SMTP_USER` / `SMTP_PASSWORD`               | Gmail / App password                                            | 1.3        |
| `MAIL_FROM`                                 | (ไม่ใส่ก็ได้) เช่น `iPlan <you@gmail.com>`                      |            |
| `DEV_LOGIN_ENABLED`                         | `false`                                                         |            |
| `STORAGE_DRIVER`                            | `s3`                                                            |            |
| `S3_ENDPOINT`                               | `https://s3.us-west-004.backblazeb2.com`                        | 1.2        |
| `S3_REGION`                                 | `us-west-004`                                                   | 1.2        |
| `S3_BUCKET`                                 | `iplan-attachments`                                             | 1.2        |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | keyID / applicationKey                                          | 1.2        |
| `S3_FORCE_PATH_STYLE`                       | `false`                                                         |            |

ระบบจะ **ไม่ยอมเปิด** ถ้า `DEV_LOGIN_ENABLED=true` หรือ `STORAGE_DRIVER` ไม่ใช่ `s3` ใน production — ถ้าลืมตั้ง จะเห็นข้อความใน Vercel → Logs ทันที

---

## ขั้นที่ 3 — เชื่อม GitHub กับ Vercel สำหรับการ deploy ด้วย tag (ทำครั้งเดียว)

production จะเปลี่ยน **เฉพาะตอนติด tag** (เช่น `v0.1.0`) เท่านั้น การ merge PR ไม่ deploy เอง (ตั้งไว้แล้วใน `apps/web/vercel.json`) แต่ PR ยังได้ลิงก์ Preview เหมือนเดิม

1. **Vercel token**: Vercel → รูปโปรไฟล์ → **Account Settings → Tokens** → Create
   - Name: `iplan-github-release`, Scope: บัญชีของคุณ, Expiration: 1 year (จดวันหมดอายุไว้)
   - คัดลอกเก็บ = `VERCEL_TOKEN`
2. **หา Project ID และ Org ID**: ในเครื่อง ที่ root ของ repo
   ```bash
   npx vercel@59.23.2 login       # เลือก Continue with GitHub
   npx vercel@59.23.2 link        # ตอบ: เลือกบัญชีคุณ → Link to existing project → iplan
   cat .vercel/project.json       # จะเห็น "orgId" และ "projectId"
   ```
   โฟลเดอร์ `.vercel/` ถูก gitignore แล้ว ไม่หลุดเข้า git
3. **GitHub Secrets**: <https://github.com/tiphurin/iPlan/settings/secrets/actions> → **New repository secret** 3 ตัว

   | Secret              | ค่า                  |
   | ------------------- | -------------------- |
   | `VERCEL_TOKEN`      | จากข้อ 1             |
   | `VERCEL_ORG_ID`     | `orgId` จากข้อ 2     |
   | `VERCEL_PROJECT_ID` | `projectId` จากข้อ 2 |

4. **GitHub Variable**: หน้าเดียวกัน แท็บ **Variables** → New repository variable
   - `APP_URL` = `https://iplan-tiphurin.vercel.app`
     (ใช้ตรวจ `/api/health` หลัง deploy และ uptime รายสัปดาห์ — คำเตือน `APP_URL` ใน VS Code จะหายไป)
5. (แนะนำ) **ให้กดอนุมัติก่อนทุก release**: Settings → **Environments** → `production` (จะมีหลัง release ครั้งแรก หรือสร้างเองได้) → **Required reviewers** = ตัวคุณ

---

## ขั้นที่ 4 — Deploy เวอร์ชันแรก (ติด tag)

เลือกทางใดทางหนึ่ง

### ทาง A: Command line (แนะนำ)

```bash
git switch feature/iPlan/main
git pull
git tag -a v0.1.0 -m "v0.1.0 first public release"
git push origin v0.1.0
```

### ทาง B: หน้าเว็บ GitHub (ไม่ต้องใช้ terminal)

1. <https://github.com/tiphurin/iPlan/releases/new>
2. **Choose a tag** → พิมพ์ `v0.1.0` → **Create new tag: v0.1.0 on publish**
3. **Target**: เลือก `feature/iPlan/main`
4. Title: `v0.1.0` → ติ๊ก **Generate release notes** → **Publish release**
   (การสร้าง tag ตรงนี้จะเริ่ม workflow เหมือนทาง A)

### ทาง C: กด Run เอง (deploy tag ที่มีอยู่แล้วซ้ำ / ย้อนเวอร์ชัน)

1. <https://github.com/tiphurin/iPlan/actions/workflows/release.yml>
2. **Run workflow** → ช่อง tag ใส่ เช่น `v0.1.0` → **Run workflow**

### ดูผล

GitHub → **Actions → Release** → จะเห็นขั้นตอน:

1. Check the tag — tag ต้องเป็นรูป `vX.Y.Z` และอยู่บน `feature/iPlan/main`
2. Same checks as CI — format, lint, typecheck, test
3. Build for production — **รัน migration บน Neon** แล้ว build
4. Deploy to production — ขึ้น Vercel
5. Smoke test — เรียก `APP_URL/api/health`
6. GitHub release notes — สร้างหน้า Release ให้อัตโนมัติ

เขียวครบ = ใช้งานได้ (ประมาณ 4–6 นาที)

---

## ขั้นที่ 5 — หลัง deploy ครั้งแรก

1. เปิด `https://iplan-tiphurin.vercel.app` จากมือถือ (ไม่ต้องอยู่ Wi-Fi เดียวกันแล้ว)
2. **บัญชี super admin**: หน้าเข้าสู่ระบบ → **เข้าสู่ระบบผู้ดูแล** → username `admin` + `SUPERADMIN_PASSWORD` → ตั้งรหัสใหม่ทันที (≥ 8 ตัว)
3. **เข้าด้วย Google** ด้วยอีเมลที่อยู่ใน `ADMIN_EMAILS` → เป็น admin ทันที
4. คนอื่นที่เข้าด้วย Google จะเห็นหน้า "รออนุมัติ" → ไปที่ **ผู้ดูแลระบบ → รออนุมัติ** เลือกฟีเจอร์/กลุ่ม/วง แล้วอนุมัติ
5. **ย้ายข้อมูลทริปจริง** (ไม่ผ่าน git): แอปในเครื่อง → ทริป → ส่งออก (backup JSON) → แอปบนเว็บ → ทริป → **นำเข้าทริปจากไฟล์**
6. **ปฏิทิน**: ทริป → ปุ่มปฏิทิน → ปฏิทิน Apple / Google ตอนนี้ subscribe ได้แล้ว (ลิงก์เป็น https)
7. **ติดตั้งเป็นแอปบน iPhone**: Safari → ปุ่มแชร์ → **Add to Home Screen** (จะได้ไอคอนใหม่)
8. หน้า **โปรไฟล์** ด้านล่างจะแสดง `iPlan v0.1.0` = เวอร์ชันที่ใช้อยู่

---

## ปล่อยเวอร์ชันถัดไป

1. Merge PR เข้า `feature/iPlan/main` (ยังไม่ขึ้นเว็บจริง)
2. ถ้า release นี้มีไฟล์ migration ใหม่ (`packages/db/migrations/00xx_*.sql`) ให้ทำจุดสำรองก่อน:
   Neon → **Branches → Create branch** จาก `main` ชื่อ `before-v0.2.0` (ฟรี ใช้เวลาไม่กี่วินาที)
3. ติด tag ใหม่ตามทาง A/B ข้างบน

| เปลี่ยนอะไร                               | เลขเวอร์ชัน         |
| ----------------------------------------- | ------------------- |
| แก้ bug อย่างเดียว                        | `v0.1.0` → `v0.1.1` |
| เพิ่มฟีเจอร์                              | `v0.1.1` → `v0.2.0` |
| เปลี่ยนใหญ่ที่ของเดิมใช้ไม่ได้ (หลัง 1.0) | `v1.4.2` → `v2.0.0` |

## ย้อนเวอร์ชัน (rollback)

- **ไม่มี migration ใหม่**: Vercel → Deployments → เลือกตัวก่อนหน้า → **Instant Rollback** หรือใช้ทาง C ใส่ tag เก่า
- **มี migration ใหม่**: อย่า deploy tag เก่าทับ (โค้ดเก่าอาจไม่เข้ากับ schema ใหม่) ให้แก้แล้วออก `vX.Y.Z+1` แทน ถ้าข้อมูลเสียหาย กู้จาก Neon branch `before-…` (Neon → Branches → Restore)

## แก้ปัญหา

| เห็นอะไร                                      | สาเหตุ / วิธีแก้                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Release ล้มที่ **Check the tag**              | tag ไม่ใช่ `vX.Y.Z` หรืออยู่บน commit ที่ยังไม่ merge → ลบ tag `git push origin :v0.1.0` แล้วติดใหม่ |
| ล้มที่ **Same checks as CI**                  | รัน `yarn validate` ในเครื่อง แก้ แล้วออกเวอร์ชันถัดไป                                               |
| ล้มที่ **Build for production**               | env ใน Vercel ไม่ครบ หรือ `DATABASE_URL` ผิด — log จะบอกชื่อตัวแปร                                   |
| ล้มที่ **Deploy**                             | `VERCEL_TOKEN` หมดอายุ/ผิด หรือ org/project id ผิด → สร้าง token ใหม่ แก้ secret                     |
| ล้มที่ **Smoke test**                         | แอปขึ้นแต่ `/api/health` ไม่ตอบ → Vercel → Logs ดู error, rollback ถ้าจำเป็น                         |
| กด Google แล้วขึ้น `redirect_uri_mismatch`    | redirect URI ใน Google Cloud ไม่ตรงกับโดเมนจริง (ต้องมี `/api/auth/callback/google`)                 |
| เข้าได้แต่ขึ้น "รออนุมัติ" ทั้งที่เป็นเจ้าของ | อีเมลไม่อยู่ใน `ADMIN_EMAILS` หรือสะกดผิด → แก้ใน Vercel แล้ว deploy ใหม่ (ทาง C)                    |
| อัปโหลดรูปไม่ได้                              | ค่า `S3_*` ผิด หรือ key ไม่ได้ให้สิทธิ์ bucket นั้น                                                  |
| ไม่ได้รับอีเมล                                | ยังไม่ตั้ง `SMTP_*` (อีเมลอยู่ใน log) หรือ App password ผิด                                          |
| ลืมรหัส `admin`                               | ตั้ง `SUPERADMIN_PASSWORD` ใหม่ใน Vercel แล้ว deploy ใหม่ (ทาง C) — ระบบจะรีเซ็ตให้                  |

## ค่าใช้จ่ายและโควตา (ฟรีทั้งหมด)

- Vercel Hobby: ใช้ส่วนตัว ไม่เชิงพาณิชย์
- Neon Free: 0.5 GB ข้อมูล, compute หลับเองเมื่อไม่มีคนใช้ (ครั้งแรกหลังหลับอาจช้า 1–2 วินาที)
- Backblaze B2: 10 GB ฟรี, รูปถูกย่อเป็น WebP ก่อนอัปโหลดแล้ว จึงใช้พื้นที่น้อย
- Gmail: 500 ฉบับ/วัน
- ดูการใช้งาน: [INFRA.md → Keeping an eye on usage](INFRA.md#keeping-an-eye-on-usage)

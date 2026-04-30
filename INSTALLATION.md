# Installation and Vercel Deployment

This guide installs the AI customer support, lead generation, booking, knowledge base, property-photo, and realtime voice-call app.

## Requirements

- Node.js 20 or newer.
- npm.
- OpenAI API key with access to the configured chat and Realtime models.
- Supabase project for Postgres.
- Supabase Storage if you want PDF archives and uploaded listing photos.
- Vercel account for hosting.

## 1. Install Locally

From the app root (`Project/`):

```powershell
npm install
```

Copy the example env file:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Fill in `.env`:

```env
OPENAI_API_KEY="sk-..."
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"
DIRECT_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..."
DASHBOARD_GATEWAY_TOKEN="a-long-random-secret-at-least-32-characters"
```

Optional Realtime voice variables:

```env
OPENAI_REALTIME_MODEL="gpt-realtime"
OPENAI_REALTIME_TRANSCRIBE_MODEL="gpt-4o-mini-transcribe"
OPENAI_REALTIME_VOICE="marin"
```

Optional image allowlist for externally hosted demo/listing photos:

```env
KNOWLEDGE_IMAGE_ALLOWED_HOSTS="picsum.photos,images.unsplash.com"
```

## 2. Supabase Setup

1. Create a Supabase project.
2. Copy the **Prisma transaction pooler** URL to `DATABASE_URL`.
3. Copy the **session pooler** URL to `DIRECT_URL`.
4. Make sure both URLs include `sslmode=require`.
5. Do not include square brackets around the password.

For PDF archives and uploaded property photos:

1. Create a Storage bucket named `knowledge-pdfs`.
2. Keep the bucket private.
3. Add `SUPABASE_SERVICE_ROLE_KEY` on the server only. Never expose it to the browser.

## 3. Database Schema and Demo Data

Push the Prisma schema:

```powershell
npm run db:push
```

Seed fictional real-estate demo knowledge and listings:

```powershell
npm run db:seed
```

Important on Windows: because this project path contains `&`, use the npm scripts above. Avoid `npx prisma db seed` from this path because PowerShell/cmd can split the path and resolve Prisma from the wrong folder.

## 4. Run Locally

```powershell
npm run dev
```

Open:

- Customer chat: `http://localhost:3000/chat`
- Voice call: `http://localhost:3000/call`
- Admin dashboard: `http://localhost:3000/admin`

Use `DASHBOARD_GATEWAY_TOKEN` to log in.

If Turbopack gives file-manifest errors on Windows:

```powershell
npm run dev:webpack
```

## 5. Vercel Deployment

1. Push the repository to GitHub.
2. In Vercel, import the repository.
3. Use the app root as the project directory if Vercel asks.
4. Build command:

```bash
npm run build
```

5. Install command:

```bash
npm install
```

6. Add all production environment variables in Vercel Project Settings.

Required Vercel variables:

- `OPENAI_API_KEY`
- `DATABASE_URL`
- `DIRECT_URL`
- `DASHBOARD_GATEWAY_TOKEN`

Recommended / feature variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_REALTIME_MODEL`
- `OPENAI_REALTIME_TRANSCRIBE_MODEL`
- `OPENAI_REALTIME_VOICE`
- `KNOWLEDGE_IMAGE_ALLOWED_HOSTS`

After deploy, run schema migration from your local machine or CI:

```powershell
npm run db:push
```

Run seed only if you want demo data in production:

```powershell
npm run db:seed
```

## 6. Security Checklist

- Use a long random `DASHBOARD_GATEWAY_TOKEN` (at least 32 characters; 64+ recommended).
- Keep `.env` out of git.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in server environments.
- Keep Supabase Storage private.
- Use HTTPS in production. Vercel provides this automatically.
- Rotate keys if they are ever shown in screenshots, commits, recordings, or logs.
- Use Vercel Firewall / WAF or a managed rate limiter for serious production traffic.
- Review admin access after deployment; there is one shared dashboard token by design.

## 7. Voice Calling

The voice call page is real browser audio:

1. Browser requests microphone permission with `getUserMedia`.
2. The client creates a `RTCPeerConnection`.
3. The client sends local SDP to `/api/realtime/calls`.
4. The server forwards the SDP and session config to OpenAI Realtime.
5. OpenAI returns answer SDP.
6. The browser receives streamed remote audio.

Requirements:

- HTTPS in production.
- Microphone permission granted by the visitor.
- Valid `OPENAI_API_KEY`.
- Realtime model access for the account.

## 8. Verification Commands

```powershell
node ./node_modules/typescript/bin/tsc --noEmit
node ./node_modules/eslint/bin/eslint.js .
npm run build
```

If `npm run lint` fails on Windows because of a path with `&`, use the direct ESLint command above from the app root.

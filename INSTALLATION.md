# Installation and Vercel Deployment

This guide installs the AI customer support, lead generation, booking, knowledge base, property-photo, and realtime voice-call app.

## Requirements

- Node.js 20 or newer.
- npm.
- OpenAI API key with access to the configured chat and Realtime models.
- [Turso](https://turso.tech) database (recommended for hosted demo) **or** local SQLite via a `file:` URL.
- Supabase **only if** you want PDF originals archived in Storage (optional).
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
DATABASE_URL="libsql://your-db-yourorg.turso.io"
TURSO_AUTH_TOKEN="your-token-from-turso-db-tokens-create"
DASHBOARD_GATEWAY_TOKEN="a-long-random-secret-at-least-32-characters"
```

For **local SQLite** instead of Turso:

```env
DATABASE_URL="file:./dev.db"
```

(omit `TURSO_AUTH_TOKEN` when using `file:`.)

Optional Supabase Storage (PDF archives):

```env
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..."
```

Optional Realtime voice variables:

```env
OPENAI_REALTIME_MODEL="gpt-realtime-2.1"
OPENAI_REALTIME_TRANSCRIBE_MODEL="gpt-transcribe"
OPENAI_REALTIME_VOICE="marin"
```

Optional image allowlist for externally hosted demo/listing photos:

```env
KNOWLEDGE_IMAGE_ALLOWED_HOSTS="picsum.photos,images.unsplash.com"
```

## 2. Turso setup (hosted database)

1. Install the [Turso CLI](https://docs.turso.tech/cli/installation) and run `turso auth login`.
2. `turso db create <name>` then `turso db show <name> --url` → `DATABASE_URL`.
3. `turso db tokens create <name>` → `TURSO_AUTH_TOKEN`.

If `npm run db:push` does not apply schema to your remote `libsql://` URL (tooling limitation), use `DATABASE_URL=file:./dev.db` for `db:push` locally (see `prisma/dev.db`), export SQL, and apply with `turso db shell` — see [Turso + Prisma](https://docs.turso.tech/sdk/ts/orm/prisma).

## 3. Supabase Storage (optional)

Only needed to store PDF binaries in a bucket:

1. Create a Storage bucket named `knowledge-pdfs`.
2. Keep the bucket private.
3. Add `SUPABASE_SERVICE_ROLE_KEY` on the server only. Never expose to the browser.

## 4. Database schema and demo data

Push the Prisma schema:

```powershell
npm run check:db-env
npm run db:push
```

Seed fictional real-estate demo knowledge and listings:

```powershell
npm run db:seed
```

Important on Windows: because this project path contains `&`, use the npm scripts above. Avoid `npx prisma db seed` from this path because PowerShell/cmd can split the path and resolve Prisma from the wrong folder.

## 5. Run Locally

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

## 6. Vercel Deployment

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
- `TURSO_AUTH_TOKEN` (when `DATABASE_URL` is `libsql://`)
- `DASHBOARD_GATEWAY_TOKEN`

Recommended / feature variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_REALTIME_MODEL`
- `OPENAI_REALTIME_TRANSCRIBE_MODEL`
- `OPENAI_REALTIME_VOICE`
- `KNOWLEDGE_IMAGE_ALLOWED_HOSTS`

After deploy, run schema migration / seed from your local machine (or CI) against the same Turso database:

```powershell
npm run db:push
npm run db:seed
```

Run seed only if you want demo data in production:

```powershell
npm run db:seed
```

## 7. Security Checklist

- Use a long random `DASHBOARD_GATEWAY_TOKEN` (at least 32 characters; 64+ recommended).
- Keep `.env` out of git.
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `TURSO_AUTH_TOKEN` only in server environments.
- Keep Supabase Storage private.
- Use HTTPS in production. Vercel provides this automatically.
- Rotate keys if they are ever shown in screenshots, commits, recordings, or logs.
- Use Vercel Firewall / WAF or a managed rate limiter for serious production traffic.
- Review admin access after deployment; there is one shared dashboard token by design.

## 8. Voice Calling

The voice call page is real browser audio:

1. Browser requests microphone permission with `getUserMedia`.
2. The client creates a `RTCPeerConnection`.
3. The client sends local SDP to `/api/realtime/calls`.
4. The server forwards the SDP and session config to OpenAI Realtime.
5. OpenAI returns answer SDP.
6. The browser receives streamed remote audio.

Requirements:

- HTTPS in production.

# AI Customer Support & Lead Gen Agent

A **sellable, self-hosted** web app: your customers talk to an AI on a **public chat page**, while **you (the business owner)** use a **separate, private dashboard** to view leads, upload business knowledge (text + PDFs), and see meetings the agent booked. The stack is designed to move cleanly to **Railway** hosting and **Supabase** for data.

This README always reflects the **current** behaviour of the code in this folder.

---

## What the product is

- **Public experience (`/`, `/chat`)** — Visitors land on the site, chat with the assistant (streaming replies), and can leave contact details or book time. **There is no link from the chat UI to the owner dashboard** so customers are not nudged toward private tools.
- **Owner dashboard (`/admin` …)** — **Only the client** uses this. After unlocking with a **gateway token** (see below), they can:
  - Browse **leads** captured by the AI (`captureLead` tool).
  - Maintain a **knowledge base** (typed notes + **PDF uploads**). Extracted text is what the model sees today (full-context injection, not vector RAG).
  - View a **meetings list** fed by the **`bookMeeting`** tool when the agent records a confirmed slot.
- **API** — `POST /api/chat` powers the widget; it uses **OpenAI** (`gpt-4o-mini` by default) and tools that write to your database.

Planned for later versions (not fully implemented here): Pinecone-style RAG, Google Calendar sync, full auth beyond the gateway token, rate limits.

---

## AI stack (LangGraph + OpenAI)

- **Text chat (`/chat`)** — The server builds a **LangGraph** `createReactAgent` graph with **ChatOpenAI** and the same **captureLead** / **bookMeeting** tool runners as the rest of the app (`lib/agent-tools.ts`). The HTTP response uses the **AI SDK UI message stream** (`createUIMessageStream` / `createUIMessageStreamResponse`) so the existing `useChat` UI keeps working.
- **Voice call (`/call`)** — **OpenAI Realtime** (WebRTC) handles speech-to-speech. Tool calls are executed in your stack via **`POST /api/realtime/tool`**, which calls `runAgentToolByName` in `lib/agent-tools.ts` (same DB writes as chat). The browser must complete the `function_call` → tool route → `function_call_output` → `response.create` sequence; if that chain fails or the database is unreachable, the **owner dashboard will stay empty** even if the model *said* it booked something.
- **Voice notes in chat** — Short recordings are sent to **`POST /api/transcribe`**, which uses the **OpenAI** Whisper-class transcription API (via the `openai` client bundled with `@langchain/openai`).

### Meet, Zoom, and phone (stored intent)

Meetings use **`meetingType`** (`google_meet`, `zoom`, `phone`, `other`) and **`locationDetail`** (link or number) on the `Meeting` model. The app **stores** what the visitor agreed to; it does **not** create Google Calendar events or Zoom conferences (that would require OAuth and separate integrations).

---

## Troubleshooting

- **Leads or meetings empty after chat/voice** — Confirm **`DATABASE_URL`** reaches your Supabase pooler (project not paused, password correct, `?sslmode=require`, outbound **5432** / **6543** allowed). Run `npm run check:db-env` and `npm run db:push`. During a voice call, open the browser **Network** tab and confirm **`/api/realtime/tool`** returns **200** when the model invokes a tool; check server logs for `[realtime/tool]` lines.
- **Prisma “Can’t reach database server”** — Usually wrong or blocked pooler URL, paused project, or local firewall. Fix connectivity before debugging application code.
- **Dev server: `ENOENT` `_buildManifest.js.tmp.*` (often on Windows + Turbopack)** — Stop the dev server, delete the **`Project/.next`** folder, then run **`npm run dev`** again. If it keeps happening, use **`npm run dev:webpack`** (Webpack dev server instead of Turbopack) or exclude the project folder from aggressive antivirus/backup sync.

---

## Where things live (important)

| Piece | Where it lives |
|--------|----------------|
| **Postgres data** (leads, meetings, knowledge rows) | **Supabase** project. **`DATABASE_URL`** (transaction pooler) + **`DIRECT_URL`** (session pooler for `db push`). |
| **PDF binaries** (optional) | **Supabase Storage** bucket `knowledge-pdfs`, if you set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. If Storage is not configured, **only extracted text** is kept in Postgres. |
| **Application code** | This repo, **`Project/`** folder (Next.js app root). |
| **Secrets** (OpenAI key, gateway token, Supabase service role) | **Environment variables** only (local `.env`, Railway variables in production). Never commit real secrets. |

There is **no SQLite** in the current schema: the database is **PostgreSQL** (Supabase).

---

## Environment variables

Copy **`.env.example`** → **`.env`** in this folder (`Project/.env`). Next.js and Prisma both load `.env` from the app root (`Project/`) for local development.

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | **Yes** (for chat) | Server-side calls to OpenAI. |
| `OPENAI_MODEL` | No | Chat model id for LangGraph / ChatOpenAI (default **`gpt-4o-mini`**). |
| `DATABASE_URL` | **Yes** | **Transaction** pooler (port **6543**, `pgbouncer=true`). Next.js runtime. |
| `DIRECT_URL` | **Yes** | **Session** pooler (port **5432**), same host and **`postgres.<ref>`** user as above. Prisma `db push` only (avoids hangs on :6543). |
| `DASHBOARD_GATEWAY_TOKEN` | **Yes in production** | Long secret the owner types at `/admin/login`. Also used to sign the **httpOnly session cookie** (HS256 via `jose`). **Minimum 32 characters.** |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project URL (for Storage uploads). |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | **Server only.** Uploads PDF originals to Storage. Never expose to the browser. |

If `DASHBOARD_GATEWAY_TOKEN` is missing or shorter than 32 characters:

- **Production** — `/admin` (except `/admin/login`) returns **503** until you set a proper token.
- **Development** — `/admin` is allowed **without** login so you can iterate quickly; **set the token before any real deployment.**

---

## Where to get an OpenAI API key

1. Create or log in to an OpenAI account: [https://platform.openai.com/](https://platform.openai.com/)
2. Open **API keys**: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
3. **Create new secret key**, copy it once, and put it in `.env` as `OPENAI_API_KEY="sk-..."`.
4. Add billing / usage limits in **Billing** if required by your account.

The app uses the key **only on the server** (e.g. `app/api/chat/route.ts`, Realtime session routes, transcription).

---

## Supabase: database + optional PDF storage

### 1) Create a project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and create a project.
2. Wait until the database is ready (green “Healthy” / finished provisioning).

### Supabase — simplest setup (two pooler URLs)

1. Supabase → **Connect** → **ORMs** → **Prisma**.
2. Copy **Transaction** → **`DATABASE_URL`** (port **6543**, must include **`pgbouncer=true`**).
3. Copy **Session** → **`DIRECT_URL`** (port **5432**, same `aws-0-…pooler.supabase.com` host and same **`postgres.<ref>`** user).
4. Use the **exact same password** in both lines (the database password you chose in Supabase). **Do not** wrap it in **`[` `]`** — docs show `[YOUR_PASSWORD]` only as a placeholder; including brackets causes **P1000**.
5. Add **`?sslmode=require`** if not already on both URLs.
6. From **`Project/`**:

```bash
npm run check:db-env
npm run db:push
```

Why two URLs: **`prisma db push`** uses **`DIRECT_URL`**. The transaction pooler (**6543**) can **hang** for migrations; the session pooler (**5432**) is the supported pair per [Supabase + Prisma](https://supabase.com/docs/guides/database/prisma).

#### Still stuck?

1. **Unpause** the project in the dashboard.
2. Reset **Database password**, paste fresh **Transaction** + **Session** strings again.
3. Allow outbound **5432** and **6543** to `*.pooler.supabase.com`.
4. Delete **`Project/.next`** after env changes.

### 3) Apply the schema (local or CI)

From **`Project/`** with **`DATABASE_URL` and `DIRECT_URL`** in `.env`:

```bash
npm run db:push
```

This runs `prisma generate` and `prisma db push` against **your** Supabase database (creates/updates tables: `Lead`, `Meeting`, `KnowledgeDocument`).

### 4) Storage bucket for PDF originals (optional)

1. **Storage → New bucket** → name: **`knowledge-pdfs`**.  
2. Keep it **private** (no public anon upload policies).  
3. **Project Settings → API**: copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`, and **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server only).

If these are omitted, PDF upload still works: **text is extracted and stored** in Postgres; the raw file is simply not archived in Storage.

---

## Owner dashboard security (gateway token)

1. Generate a long random secret, e.g.  
   `openssl rand -base64 48`  
   and set it as `DASHBOARD_GATEWAY_TOKEN` in `.env` / Railway.
2. Open **`/admin/login`** (bookmark this; it is not linked from the public chat).
3. Paste the same value into the form. On success, the server sets an **httpOnly, signed** cookie (`dashboard_session`) valid for **7 days**.
4. Use **Log out** on the dashboard to clear the cookie.

**Threat model note:** anyone who knows `/admin/login` can *attempt* logins. Use a **long, unguessable** gateway token, HTTPS in production (Railway provides TLS), and rotate the token if it leaks.

---

## Local setup (full)

1. **Install dependencies** (from **`Project/`**):

   ```bash
   npm install --ignore-scripts --legacy-peer-deps
   ```

   On Windows, if the project path contains **`&`**, `npm install` scripts may fail; `--ignore-scripts` avoids that.

2. **Environment** — copy `.env.example` to `.env` and fill:
   - `OPENAI_API_KEY`
   - **`DATABASE_URL`** + **`DIRECT_URL`** (Connect → ORMs → Prisma → **Transaction** + **Session**) — see **Supabase — simplest setup** below
   - `DASHBOARD_GATEWAY_TOKEN` (32+ chars; recommended for local too)
   - Optionally Supabase Storage vars and create bucket `knowledge-pdfs`.

3. **Database schema**:

   ```bash
   npm run check:db-env
   npm run db:push
   ```

4. **Run the app**:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) — you are redirected to **`/chat`** (public).  
   Open [http://localhost:3000/admin/login](http://localhost:3000/admin/login) for the **owner dashboard**.

---

## Railway deployment (outline)

1. Create a **new Railway service** from this repo; set the **root directory** to **`Project`** (the folder that contains `package.json` and `next.config.ts`). If you only deploy this app, the service root should be **`Project/`**, not the parent marketing/docs folder.
2. **Build command:** `npm run build`  
3. **Start command:** `npm run start`
4. Add the **same environment variables** as in `.env.example` (OpenAI, **`DATABASE_URL` + `DIRECT_URL`**, gateway token, optional Supabase Storage).
5. Use your Railway **HTTPS URL** for production; update any marketing links to `/chat` only.

Railway runs **Node**; your **data** still lives in **Supabase Postgres** (and optionally Supabase Storage), not on Railway’s filesystem.

---

## npm scripts (reference)

| Script | What it does |
|--------|----------------|
| `npm run dev` | Next.js dev server (Turbopack). |
| `npm run dev:webpack` | Same without Turbopack (fallback if `.next` manifest errors on Windows). |
| `npm run build` | `prisma generate` + production Next build. |
| `npm run start` | Production server (after `build`). |
| `npm run db:push` | `prisma generate` + `prisma db push` (schema to Supabase). |
| `npm run check:db-env` | Verifies pooler URLs use `postgres.<project-ref>` (avoids common **P1000**). |
| `npm run lint` | ESLint. |

Scripts call **`node ./node_modules/next/...`** and **`node node_modules/prisma/...`** so Windows paths containing **`&`** do not break `npx`.

---

## Project layout (high level)

| Path | Role |
|------|------|
| `app/chat/` | Public chat UI. |
| `app/admin/` | Owner dashboard (protected by middleware + cookie). |
| `app/admin/login/` | Gateway token login (public). |
| `app/api/chat/` | Streaming chat (LangGraph agent + UI message stream) + tools (`captureLead`, `bookMeeting`). |
| `lib/langgraph/` | Sales chat graph (`createReactAgent`), UI message → LangChain adapter, stream bridge. |
| `app/api/realtime/tool/` | Executes the same tools for OpenAI Realtime voice. |
| `app/api/transcribe/` | Whisper-class transcription for voice notes. |
| `prisma/schema.prisma` | Postgres models. |
| `middleware.ts` | Protects `/admin` routes. |
| `lib/knowledge.ts` | Builds knowledge context for the model. |
| `lib/dashboard-session.ts` | Signed session cookie helpers. |
| `lib/supabase-server.ts` | Service-role Supabase client for Storage. |

---

## Support / product docs

- Product vision and phases: repo root **`CURSOR.md`**.  
- Engineering rules: **`../.cursorrules`** (one level up from `Project/`, at the repo root).

When you change behaviour (new env vars, routes, or tools), update **this README** in the same change so the next deploy stays documented.
#   l e a d - g e n - a i - a g e n t - d e m o  
 #   l e a d - g e n - a i - a g e n t - d e m o  
 
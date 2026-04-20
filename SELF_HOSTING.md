# Self-Hosting Guide

This guide explains how to run **Vault Code Cracks** locally or on your own infrastructure, without depending on Lovable Cloud.

The app is a **Vite + React + TypeScript** SPA that talks to a **Supabase** backend (Postgres + Auth + Edge Functions + Realtime). To self-host, you need to provision your own Supabase project (cloud or self-hosted) and point the app at it.

---

## 1. Prerequisites

Install the following:

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | ≥ 18 (20 LTS recommended) | Build & run the frontend |
| [npm](https://www.npmjs.com/) / [bun](https://bun.sh/) / [pnpm](https://pnpm.io/) | latest | Package manager |
| [Git](https://git-scm.com/) | any | Clone the repo |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | ≥ 1.180 | Apply migrations & deploy edge functions |
| [Docker](https://www.docker.com/) | latest | Required only if you want to run Supabase **locally** |

---

## 2. Get the code

```bash
git clone <your-fork-or-export-url> vault-code-cracks
cd vault-code-cracks
npm install
```

> If you're exporting from Lovable, use the **GitHub** integration to push the project to your own repo first.

---

## 3. Provision a Supabase backend

You have two options. Pick one.

### Option A — Hosted Supabase (easiest)

1. Create a free project at [supabase.com](https://supabase.com/dashboard).
2. Note these values from **Project Settings → API**:
   - `Project URL` (e.g. `https://abcdefgh.supabase.co`)
   - `anon` public key
   - `service_role` secret key (server-only, never ship to the browser)
3. Note your **Project Ref** (the subdomain part, e.g. `abcdefgh`).

### Option B — Self-hosted Supabase

Follow the official guide: <https://supabase.com/docs/guides/self-hosting/docker>.

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Edit .env (set POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, SITE_URL, ...)
docker compose up -d
```

Once running, the Studio is at `http://localhost:8000` and the API at `http://localhost:8000` (Kong gateway). The `anon` and `service_role` keys are the ones you set in `.env`.

---

## 4. Apply database migrations

All schema changes live in `supabase/migrations/`. Apply them to your new project.

### Link the CLI to your project

For **hosted Supabase**:

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

For **self-hosted Supabase**, point the CLI directly at your Postgres:

```bash
export SUPABASE_DB_URL="postgresql://postgres:<PASSWORD>@localhost:5432/postgres"
```

### Push migrations

```bash
supabase db push
```

This creates all tables (`profiles`, `rooms`, `room_secrets`, `guesses`, `presence`, `matchmaking_queue`, `daily_results`), enums (`room_mode`, `room_status`), RLS policies, and database functions (`get_daily_streak`, `get_daily_leaderboard`, `is_room_participant`, `handle_new_user`, `update_updated_at_column`).

> ⚠️ The `handle_new_user` trigger auto-creates a `profiles` row when a new auth user signs up. Verify it was attached to `auth.users` after migration. If not, add it manually in SQL:
> ```sql
> create trigger on_auth_user_created
>   after insert on auth.users
>   for each row execute function public.handle_new_user();
> ```

---

## 5. Deploy edge functions

The game's server-side logic lives in `supabase/functions/`:

- `create-room`, `join-room`, `quick-match`, `rematch`
- `set-secret`, `submit-guess`, `reveal-secrets`
- `heartbeat`, `forfeit`

Deploy them all:

```bash
supabase functions deploy create-room
supabase functions deploy join-room
supabase functions deploy quick-match
supabase functions deploy rematch
supabase functions deploy set-secret
supabase functions deploy submit-guess
supabase functions deploy reveal-secrets
supabase functions deploy heartbeat
supabase functions deploy forfeit
```

Or in one shot:

```bash
for fn in create-room join-room quick-match rematch set-secret \
          submit-guess reveal-secrets heartbeat forfeit; do
  supabase functions deploy "$fn"
done
```

### Function secrets

Edge functions use `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. On hosted Supabase these are injected automatically. On self-hosted, set them:

```bash
supabase secrets set \
  SUPABASE_URL="https://your-domain" \
  SUPABASE_ANON_KEY="..." \
  SUPABASE_SERVICE_ROLE_KEY="..."
```

> The app does **not** require `LOVABLE_API_KEY` — that secret is Lovable-specific and only used if you wire in Lovable AI features. Skip it for self-hosting.

---

## 6. Configure Auth

In **Authentication → Providers** of your Supabase project:

1. **Email**: enable. For local dev, you may want to enable "Auto-confirm" so signups work without an SMTP server.
2. **Anonymous sign-ins**: enable (the app supports guest play).
3. **Google** (optional): enable and add OAuth client ID/secret.
4. **URL Configuration**:
   - **Site URL**: `http://localhost:5173` for dev, your real domain for prod.
   - **Redirect URLs**: add both `http://localhost:5173/**` and `https://your-domain/**`.

---

## 7. Wire the frontend to your backend

The Supabase client lives at `src/integrations/supabase/client.ts` and reads from `.env`:

```env
VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your-anon-key>"
VITE_SUPABASE_PROJECT_ID="<your-project-ref>"
```

Create a `.env` file in the project root with those three values.

> On Lovable, this file is auto-managed and you cannot edit it. Once self-hosting, you own it. Add `.env` to `.gitignore` if it isn't already.

### Regenerate the typed schema (optional but recommended)

If you change the schema, regenerate types so TypeScript stays accurate:

```bash
supabase gen types typescript --project-id <YOUR_PROJECT_REF> \
  > src/integrations/supabase/types.ts
```

---

## 8. Run locally

```bash
npm run dev
```

Open <http://localhost:5173>. You should be able to:

- Sign up / sign in (or play as guest)
- Create a private room and share the code
- Join Quick Match
- Play the Daily Puzzle
- See stats and the leaderboard

If anything 401s, check the browser console + Supabase **Logs → Edge Functions** / **Logs → Postgres**.

---

## 9. Build for production

```bash
npm run build
```

This produces a static bundle in `dist/`. Serve it with any static host:

### Option 1 — Netlify / Vercel / Cloudflare Pages

Drop `dist/` in, or connect the Git repo. Set the env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) in the dashboard. Add an SPA rewrite to `index.html`:

- Netlify: `public/_redirects` → `/*  /index.html  200`
- Vercel: works out of the box for Vite
- Cloudflare Pages: framework preset = Vite

### Option 2 — Nginx / Caddy / Apache

Serve `dist/` and add SPA fallback so deep links work.

**Nginx**:

```nginx
server {
  listen 80;
  server_name your-domain;
  root /var/www/vault-code-cracks/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

**Caddy**:

```
your-domain {
  root * /var/www/vault-code-cracks/dist
  try_files {path} /index.html
  file_server
}
```

### Option 3 — Docker

A minimal Dockerfile:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
}
EOF
EXPOSE 80
```

Build & run:

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://xxx.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=eyJ... \
  --build-arg VITE_SUPABASE_PROJECT_ID=xxx \
  -t vault-code-cracks .
docker run -p 8080:80 vault-code-cracks
```

---

## 10. Realtime

Several features use Supabase Realtime (presence, room updates, live guesses). It's enabled by default on hosted Supabase. On self-hosted, make sure the `realtime` service is up in your `docker-compose.yml` and that the relevant tables are added to the `supabase_realtime` publication — the migrations already do this for the multiplayer tables.

To verify:

```sql
select schemaname, tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime';
```

---

## 11. Going Lovable-free: what to remove

If you no longer use Lovable at all, you can safely:

- Remove `lovable-tagger` from `devDependencies` and the corresponding plugin in `vite.config.ts`.
- Delete `supabase/config.toml`'s `project_id` (or replace with your own).
- Stop syncing `src/integrations/supabase/types.ts` from Lovable — regenerate it with the Supabase CLI as shown above.
- Ignore any references in chat/docs to "Lovable Cloud" — functionally it's just Supabase.

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Blank page, console: `Invalid API key` | `.env` not loaded | Restart `npm run dev` after editing `.env` |
| 401 on edge function calls | Function not deployed, or JWT verification mismatch | Re-deploy the function; check `supabase/config.toml` per-function `verify_jwt` flags |
| Signups succeed but no profile row | `handle_new_user` trigger missing | Re-run migration or attach trigger manually (see §4) |
| Realtime updates don't arrive | Table not in publication | `alter publication supabase_realtime add table public.<name>;` |
| Daily leaderboard empty | RLS blocking anon select on `daily_results` | Confirm policies from migrations were applied |
| Deep link 404s in production | No SPA fallback | Add the rewrite rule for your host (see §9) |

---

## 13. Reference

- App stack: React 18, Vite 5, TypeScript 5, Tailwind 3, shadcn/ui, TanStack Query, React Router 6, Supabase JS v2
- Backend: Supabase (Postgres 15, GoTrue, Realtime, Edge Functions on Deno)
- Supabase docs: <https://supabase.com/docs>
- Supabase CLI: <https://supabase.com/docs/guides/cli>
- Self-host Supabase: <https://supabase.com/docs/guides/self-hosting>

# Light

Minimalist messenger — Web (Vite/React) with real auth + calling, mobile (Expo)
scaffolded but unbuilt/untested, backend (Fastify + Postgres + Prisma).

## Structure

```
light-app/
├── web/                # Vite + React PWA — OAuth login, real WebRTC calls
├── server/              # Fastify + Postgres/Prisma + OAuth + WebSocket signaling
├── mobile/              # Expo + CallKeep + FCM — UNTESTED, see warnings below
├── render.yaml           # all 3 Render resources: web, backend, Postgres
└── .gitignore
```

## One-time setup — OAuth apps (required before login works)

You need a developer "app" registered with each provider. Free, but manual:

| Provider | Where | Redirect URI to register |
|---|---|---|
| Google | console.cloud.google.com → APIs & Services → Credentials | `<web-url>/auth/callback/google` |
| GitHub | github.com/settings/developers → New OAuth App | `<web-url>/auth/callback/github` |
| Discord | discord.com/developers/applications → OAuth2 | `<web-url>/auth/callback/discord` |

For local dev, `<web-url>` is `http://localhost:5173`. Each gives you a
**Client ID** and **Client Secret**.

## One-time setup — Postgres

Local dev: install Postgres, then `createdb light`, or use a free hosted
instance (Render Postgres, Supabase, Neon — any standard Postgres URL works).

## Run locally — two terminals

```bash
# Terminal 1 — backend
cd server
npm install
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET, GOOGLE/GITHUB/DISCORD client id+secret
npx prisma migrate dev --name init
npm run dev          # :3001
```

```bash
# Terminal 2 — web app
cd web
npm install
cp .env.example .env.local
# Fill in: VITE_GOOGLE_CLIENT_ID, VITE_GITHUB_CLIENT_ID, VITE_DISCORD_CLIENT_ID
npm run dev           # :5173
```

Open `http://localhost:5173` — you'll see a real sign-in screen. Pick a
provider, complete the OAuth flow, land back in the app as a real signed-in
user (stored in Postgres, not a hardcoded demo id anymore).

## Test a call between two real accounts

1. Sign in on browser tab 1 with Google (or any provider)
2. Sign in on browser tab 2 with a **different** account (or different provider)
3. Each tab shows its own user id under the profile row — copy tab 2's id
4. In tab 1, paste tab 2's id into "Call user id", click Voice or Video Call
5. Tab 2 shows the incoming-call banner — Accept

## Deploy to Render

`render.yaml` now provisions **three** resources in one Blueprint:

| Resource | Type |
|---|---|
| `light-web-pwa` | Static Site |
| `light-backend` | Web Service |
| `light-postgres` | Postgres (free tier) |

`Render Dashboard → New → Blueprint → connect repo → Apply`. `DATABASE_URL`
and `JWT_SECRET` are wired automatically. You still have to manually paste
in the Render dashboard: `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`,
`DISCORD_CLIENT_ID/SECRET`, and the matching `VITE_*_CLIENT_ID` values on the
frontend service — these are marked `sync: false` in `render.yaml` on purpose,
so they're never committed to the repo.

⚠️ Update each OAuth app's redirect URI to your real Render URL once deployed
(`https://light-web-pwa.onrender.com/auth/callback/google`, etc.) — the
`localhost` ones you registered for local dev won't work in production.

## What's real vs. still missing

| Real ✅ | Still missing / untested ❌ |
|---|---|
| OAuth login (Google/GitHub/Discord) via Postgres | Persisted chat messages (no Message model yet) |
| Real WebRTC calls between two signed-in users | TURN server (calls fail on strict NATs) |
| FCM device-token persistence in Postgres | Mobile app — **written but never run/built/tested** |
| Call UI, sounds, PWA shell | Contact lists — user ids are exchanged manually right now |

The `mobile/` folder is the highest-risk part of this repo: it has never been
compiled, never run on a device, and depends on a Firebase project you
haven't created yet. Treat it as a draft, not a working app, until you've
walked through building it yourself and report back what breaks.

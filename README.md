# Light

Minimalist messaging app — Web (Vite/React), Mobile (React Native), Backend (Fastify) coming soon.

## Structure

```
light-app/
├── web/
│   ├── public/
│   │   ├── icons/          # PWA icons (72px – 512px, incl. maskable)
│   │   ├── sounds/         # original synthesized call sound effects (mp3)
│   │   ├── manifest.json   # PWA manifest
│   │   ├── sw.js           # service worker — offline cache + Web Push
│   │   └── favicon*, apple-touch-icon.png
│   └── src/
│       ├── components/CallOverlay.tsx
│       ├── hooks/useCallSounds.ts
│       └── types/call.ts
├── render.yaml
└── .gitignore
```

`mobile/` and `server/` folders will be added in the same pattern when scaffolded.

## Run the web app locally

```bash
cd web
npm install
npm run dev
```

Opens at http://localhost:5173.

- **Outgoing Voice/Video Call** → plays a looping dial tone
- **Incoming Voice Call** → plays a looping ringtone
- Yellow **DEBUG** button (bottom-left) steps through call states:
  `ringing → connecting → connected → disconnected`
  — connect/disconnect chimes play automatically on those transitions.
- Mute / video / speaker buttons play a short tap sound.

All sounds in `public/sounds/` are **original, synthesized audio** — not sampled
or extracted from any existing app. Swap them for your own files anytime; just
keep the same filenames or update `src/hooks/useCallSounds.ts`.

## Build for production

```bash
cd web
npm run build
```

Output goes to `web/dist/`.

## Deploy to Render

This repo includes `render.yaml` at the root. In the Render dashboard:

`New > Blueprint > Connect this repo` — Render will read `render.yaml` automatically.

Or manually:
- **Build Command**: `cd web && npm install && npm run build`
- **Publish Directory**: `web/dist`

## PWA notes

- `manifest.json` + icon set support **installable** behavior on iOS/Android/desktop.
- `sw.js` does network-first caching for HTML (always fresh when online, falls back
  to cache offline) and stale-while-revalidate for static assets.
- Web Push (`sw.js` `push` event) is wired to handle incoming-call-style notifications
  with Accept/Decline actions — but you still need a backend that calls the
  [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) to actually
  send them. That's part of the upcoming `server/` work.

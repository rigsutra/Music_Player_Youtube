# Music Streaming App (YouTube → Google Drive)

Lightweight Next.js + Express app to download audio from YouTube, upload it to a Google Drive "Music Player" folder, and stream from a simple web UI.

## Core features

- Next.js frontend (`app/`) with Material UI + framer-motion
- Express backend (`server/`) handling Google OAuth, download/upload flows, and an SSE progress stream
- Optimistic UI: uploads show immediately in the library while they process in the background
- Client stores using Zustand for music state and upload progress

## Repository layout (important files)

- `app/` — Next.js pages and client UI (home page in `app/page.js`)
- `app/components/` — UI components (AddSongModal.jsx, SongCard.js, AudioPlayer.js, AuthButton.js)
- `hooks/` — client hooks (e.g. `useUploadProgress.js`)
- `lib/` — client helpers and config (`api.js`, `config.js`, `store.js`, `uploadStore.js`)
- `server/` — Express app and supporting code (routes, services, models)
  - `server/routes/upload.js` — start uploads, progress endpoint, SSE stream
  - `server/routes/songs.js` — list user files (enhanced with uploadId mapping)
  - `server/services/` — Google Drive helpers

## Quick run (Windows PowerShell)

1. Install dependencies

```powershell
npm install
```

2. Create `.env` in the project root with required Google credentials:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

3. Start the frontend (Next.js dev):

```powershell
npm run dev
```

4. Start the backend Express server in another terminal:

```powershell
npm run server
# or: npm start (server uses port 8000 by default)
```

> Note: `API_BASE` in `lib/config.js` should point to the backend (e.g. `http://localhost:8000`). Next.js may pick a different port if 3000 is in use.

## How uploads and UI synchronization work

- When you start an upload the frontend:
  - Creates an optimistic song row (with `uploadId` and `stage`) and adds it to the UI immediately
  - Adds the upload to `uploadStore` so progress can be reconciled in real-time
  - Subscribes to an SSE stream (`/api/upload/progress/:uploadId/stream`) via `useUploadProgress`
- The SSE stream sends JSON messages with fields: `progress`, `stage`, `googleFileId`, `videoTitle`, `fileName`, `error`.
- The SSE hook updates `uploadStore`, dispatches a normalized `upload-complete` browser event (with `{ uploadId, success, googleFileId?, videoTitle? }`) when finished, and triggers a UI reconciliation.
- The home page listens for `upload-complete` and attempts to `fetchSongs()` several times (short retries) to account for Google Drive eventual consistency. If Drive still doesn't list the file, the UI will update the optimistic item locally using the `googleFileId`/`videoTitle` supplied by SSE.

## Debugging tips

- Open browser devtools console and look for these logs added to aid debugging:
  - `🎯 Adding upload to store:` when optimistic uploads are created
  - `📡 SSE message received:` when SSE messages arrive
  - `🔄 Updating upload in store:` when the uploadStore is updated
  - `🎵 Song card state:` what the UI sees for each song
  - `🎉 Dispatching upload-complete (success):` when an upload finishes
- Server logs: run the backend and watch the console output for upload processing logs
- If you see 'Upload done' in MongoDB but the UI still shows "Uploading":
  - Confirm the SSE stream for that `uploadId` emitted a `done` message including `googleFileId`
  - Confirm the frontend received the SSE and `uploadStore` updated (look for `🔄 Updating upload in store`)

## Recent changes

- Normalized SSE event payloads and improved client-side handling so `upload-complete` events have a consistent shape.
- Introduced `uploadStore` (Zustand) and wired `useUploadProgress` to update it from SSE messages.
- Changed the Add Song flow to create optimistic items with a `stage` and register them in `uploadStore`.
- Home page now merges optimistic items with server-provided songs via `uploadId` and retries fetches briefly to handle Drive eventual consistency.

## Troubleshooting common issues

- If the frontend cannot connect to SSE (`/api/upload/progress/:uploadId/stream`) — ensure backend is running on `API_BASE` and correct CORS/auth are configured.
- If Google OAuth fails, check redirect URI in Google console and `.env` values.

## Extras

- `debug.md` (added to repo) contains a quick checklist for testing the upload flow locally.

## Next steps I can do for you

- Add an explicit debug route that returns the server's `Upload` records (development only) so you can inspect upload state without accessing Mongo directly.
- Add a small automated test that simulates SSE messages and asserts the store and UI update correctly.

## License

No license included. Add one if you plan to publish.

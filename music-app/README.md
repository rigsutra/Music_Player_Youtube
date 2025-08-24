Music Streaming App (YouTube -> Google Drive)

Project overview

This project is a lightweight Next.js + Express app that lets you download audio from YouTube and store it in a Google Drive "Music Player" folder, then stream those files in a simple web UI.

The app includes:

- Next.js frontend (app dir) using Material UI and framer-motion for the UI/animations
- Express server in `server/` that handles Google OAuth, downloading from YouTube, uploading to Google Drive, and an SSE endpoint for progress
- A small Zustand store for client-side state

Repository structure

- `app/` - Next.js client pages and components
  - `page.js` - Home page with library and Add Song modal
  - `components/` - UI components (AddSongModal.jsx, SongCard.js, AuthButton, AudioPlayer, etc.)
- `lib/` - client helpers and config (API_BASE, utils, store)
- `server/` - Express server and helpers
  - `index.js` - main server that handles Google OAuth and upload flow
  - `tokens.json` - (ignored in git) persistent user tokens (local dev)
  - `folder.json` - stores the Music Player folder id
- `.next/`, `node_modules/`, `dist/` - build and dependency output (ignored)

Important files

- `package.json` - scripts and dependencies. Key scripts:
  - `npm run dev` - run Next.js dev server
  - `npm run build` - build Next.js app
  - `npm run start` or `npm run server` - start the Express server

Environment variables (required)

The server uses Google OAuth and requires the following environment variables (set in `.env` for local dev):

- `GOOGLE_CLIENT_ID` - Google OAuth client id
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth redirect URI (must match Google console)

Security & tokens

- `server/tokens.json` and `tokens.json` are included in `.gitignore` and used to store OAuth tokens locally for development.
- Never commit `tokens.json`, `.env`, or any secret files.

How to run locally (Windows PowerShell)

1. Install dependencies:

```powershell
npm install
```

2. Create a `.env` file in the project root with the required Google credentials.

3. Start the Next.js dev server:

```powershell
npm run dev
```

4. In another terminal, start the Express server for Google Drive handling (if needed):

```powershell
npm run server
```

Notes: the Express server binds to a port (default 8000). The Next.js front-end expects `API_BASE` in `lib/config.js` to point to the server (e.g., `http://localhost:8000`).

Common issues & troubleshooting

- "songs.map is not a function": ensure the `/api/songs` endpoint returns an array (server returns `response.data.files`) and frontend sets `songs` to an array. The app includes defensive checks to avoid mapping non-arrays.
- Modal doesn't reopen after hiding: the toast now dispatches `open-add-song` and the page listens and opens the modal. If toast click doesn't reopen, check browser console for errors.
- Stuck background toast: closing and re-opening the page clears toasts. The code dismisses toasts when upload completes.
- Google OAuth problems: check redirect URI and that OAuth tokens are saved to `server/tokens.json`.

Development tips

- The project uses Node 22.x (see `engines` in `package.json`). Use nvm or n to match Node version.
- To inspect server logs, run `node server/index.js` (or `npm run server`) and watch console output.

What I changed recently (notes for reviewers)

- Improved robustness around optimistic updates and background refresh. The app now avoids resetting the UI during background fetches so the library doesn't flash "no songs" while a background refetch is in progress.
- Fixed modal open/close race: hiding the upload modal now calls `onClose()` and the toast dispatches an `open-add-song` event which `app/page.js` listens to and reopens the modal when the user clicks the toast.

If you'd like

- I can add a short debug route to show the server's current `tokens.json` contents (local only) for easier troubleshooting.
- Implement automatic retries for background refresh if the file isn't present yet.

License

This repository is provided without a license. Add one if you plan to share it publicly.

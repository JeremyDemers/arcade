# Tetris

## Features

- Next.js game client with keyboard and on-screen controls
- FastAPI backend with SQLite persistence
- Direct Google sign-in with backend-verified ID tokens
- Automatic score submission at game over
- Top-ten leaderboard
- Player stats for best score, total runs, and total lines
- Hold queue, next-piece preview, ghost drop, pause, soft drop, and hard drop

## Controls

- Arrow left/right: move
- Arrow down: soft drop
- Arrow up, `X`, `A`, or `D`: rotate
- Space: hard drop
- `C`: hold
- `P`: pause

## Sound Effects

Place MP3 files in `tetris/frontend/public/sounds/` with these names:

- `tetris-move-right-left.mp3`
- `tetris-rotate.mp3`
- `tetris-drop.mp3`
- `tetris-line-cleared.mp3`
- `tetris_theme.mp3`

The game includes mute and volume controls in the right panel. The theme loops while a game is playing and stops when the run ends.

## Local Run

Create `tetris/frontend/.env.local` from `.env.example`:

`tetris/frontend/.env.local`

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789-example.apps.googleusercontent.com
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Export the same Google Web Client ID and a private token-signing secret for the backend:

```bash
export GOOGLE_CLIENT_ID=123456789-example.apps.googleusercontent.com
export ARCADE_SECRET=choose-a-long-random-value
```

Backend:

```bash
cd tetris/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd tetris/frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

See `../docs/google-auth-setup.md` for Google Cloud and production-domain configuration.

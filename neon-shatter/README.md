# Neon Shatter

A neon brick-breaker game for the Arcade collection.

## Features

- Responsive canvas gameplay with keyboard, pointer, and touch controls
- Increasing sectors, reinforced bricks, accelerating ball speed, and combo scoring
- Three lives with automatic score submission at game over
- Direct Google sign-in with backend-verified ID tokens
- FastAPI and SQLite score persistence
- Top-ten leaderboard and player statistics
- Procedural graphics, Web Audio sound effects, and looped background music with mute and volume controls

The background track lives at `frontend/public/sounds/neon-shatter.mp3`. It starts with a run, pauses with the game, and resets when the run ends.

## Controls

- Left/right arrows or `A`/`D`: move the paddle
- Space or Enter: start and launch the ball
- `P`: pause or resume
- Pointer/touch: drag across the playfield or use the on-screen buttons

## Local development

Create `frontend/.env.local` from `frontend/.env.example`, then export the same Google Web Client ID for the backend.

Backend:

```bash
cd neon-shatter/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export GOOGLE_CLIENT_ID=123456789-example.apps.googleusercontent.com
export ARCADE_SECRET=choose-another-long-random-value
uvicorn app.main:app --reload --port 8001
```

Frontend:

```bash
cd neon-shatter/frontend
npm install
npm run dev -- --port 3001
```

Open `http://localhost:3001`. See `../docs/google-auth-setup.md` for Google Cloud and production-domain configuration.

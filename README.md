# Arcade

A SaaS-style classic arcade collection. Each game lives in its own directory with a Next.js frontend and FastAPI backend.

Authentication uses Google Identity Services directly. See `docs/google-auth-setup.md` before running either game.

## Games

- `tetris/` - playable Tetris with login, automatic score saving, player stats, and a top-ten leaderboard.
- `neon-shatter/` - neon brick breaker with escalating sectors, combo scoring, touch controls, accounts, and leaderboards.

## Tetris Development

Start the backend:

```bash
cd tetris/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export GOOGLE_CLIENT_ID=123456789-example.apps.googleusercontent.com
export ARCADE_SECRET=choose-a-long-random-value
uvicorn app.main:app --reload --port 8000
```

Start the frontend in a second terminal:

```bash
cd tetris/frontend
npm install
npm run dev
```

Then open the Next.js app at `http://localhost:3000`.

The frontend reads `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_API_BASE_URL`; the API URL defaults to `http://localhost:8000`.
For production, set a strong `ARCADE_SECRET` on the backend so auth tokens are signed with a private value.

## Neon Shatter Development

Neon Shatter runs alongside Tetris on ports `3001` and `8001`. See
`neon-shatter/README.md` for setup, environment variables, and controls.

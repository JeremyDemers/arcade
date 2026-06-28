from __future__ import annotations

import os
import re
import sqlite3

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .auth import create_token, decode_token, hash_password
from .database import get_connection, init_db
from .google_identity import verify_google_credential
from .schemas import AuthResponse, GoogleExchangeRequest, ScoreCreate, ScoreResponse, StatsResponse, UserResponse

GAME_SLUG = "neon-shatter"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
LOCAL_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
CONFIGURED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ARCADE_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
ALLOWED_ORIGINS = list(dict.fromkeys([*LOCAL_ORIGINS, *CONFIGURED_ORIGINS]))

app = FastAPI(title="Arcade Neon Shatter API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


def current_user(authorization: str | None = Header(default=None)) -> sqlite3.Row:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    payload = decode_token(authorization.removeprefix("Bearer ").strip())
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    with get_connection() as connection:
        user = connection.execute("SELECT id, username, picture_url FROM users WHERE id = ?", (payload["sub"],)).fetchone()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user")
    return user


def normalized_username(identity: dict[str, object]) -> str:
    email = str(identity.get("email") or "")
    raw = str(identity.get("name") or email.partition("@")[0] or "player")
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "_", raw)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_").lower()
    return (cleaned or "player")[:24]


def available_username(connection: sqlite3.Connection, preferred: str, subject: str) -> str:
    if not connection.execute("SELECT 1 FROM users WHERE username = ?", (preferred,)).fetchone():
        return preferred
    suffix = re.sub(r"[^a-zA-Z0-9]", "", subject)[-6:].lower() or "google"
    candidate = f"{preferred[:17]}_{suffix}"[:24]
    counter = 2
    while connection.execute("SELECT 1 FROM users WHERE username = ?", (candidate,)).fetchone():
        tail = f"_{counter}"
        candidate = f"{preferred[:24 - len(tail)]}{tail}"
        counter += 1
    return candidate


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/google", response_model=AuthResponse)
def google_exchange(payload: GoogleExchangeRequest) -> AuthResponse:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    try:
        identity = verify_google_credential(payload.credential, GOOGLE_CLIENT_ID)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid Google credential") from exc

    subject = str(identity["sub"])
    picture_url = str(identity.get("picture") or "").strip() or None
    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, username, picture_url FROM users WHERE external_provider = 'google' AND external_subject = ?",
            (subject,),
        ).fetchone()
        if user:
            connection.execute("UPDATE users SET picture_url = ? WHERE id = ?", (picture_url, user["id"]))
            user = connection.execute("SELECT id, username, picture_url FROM users WHERE id = ?", (user["id"],)).fetchone()
        else:
            username = available_username(connection, normalized_username(identity), subject)
            cursor = connection.execute(
                "INSERT INTO users (username, password_hash, external_provider, external_subject, picture_url) VALUES (?, ?, 'google', ?, ?)",
                (username, hash_password(f"google:{subject}"), subject, picture_url),
            )
            user = connection.execute("SELECT id, username, picture_url FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()

    response_user = UserResponse(id=user["id"], username=user["username"], picture_url=user["picture_url"])
    return AuthResponse(token=create_token(response_user.id, response_user.username), user=response_user)


@app.get("/me", response_model=UserResponse)
def me(user: sqlite3.Row = Depends(current_user)) -> UserResponse:
    return UserResponse(id=user["id"], username=user["username"], picture_url=user["picture_url"])


@app.get("/games/neon-shatter/leaderboard", response_model=list[ScoreResponse])
def leaderboard() -> list[ScoreResponse]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT scores.id, users.username, scores.score, scores.level, scores.bricks, scores.created_at
            FROM scores JOIN users ON users.id = scores.user_id
            WHERE scores.game_slug = ?
            ORDER BY scores.score DESC, scores.created_at ASC LIMIT 10
            """,
            (GAME_SLUG,),
        ).fetchall()
    return [ScoreResponse(**dict(row)) for row in rows]


@app.post("/games/neon-shatter/scores", response_model=ScoreResponse, status_code=status.HTTP_201_CREATED)
def save_score(payload: ScoreCreate, user: sqlite3.Row = Depends(current_user)) -> ScoreResponse:
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO scores (user_id, game_slug, score, level, bricks) VALUES (?, ?, ?, ?, ?)",
            (user["id"], GAME_SLUG, payload.score, payload.level, payload.bricks),
        )
        row = connection.execute(
            """
            SELECT scores.id, users.username, scores.score, scores.level, scores.bricks, scores.created_at
            FROM scores JOIN users ON users.id = scores.user_id WHERE scores.id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
    return ScoreResponse(**dict(row))


@app.get("/games/neon-shatter/stats", response_model=StatsResponse)
def player_stats(user: sqlite3.Row = Depends(current_user)) -> StatsResponse:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT COUNT(*) AS games_played, COALESCE(MAX(score), 0) AS best_score,
                   COALESCE(SUM(bricks), 0) AS total_bricks
            FROM scores WHERE game_slug = ? AND user_id = ?
            """,
            (GAME_SLUG, user["id"]),
        ).fetchone()
    return StatsResponse(**dict(row))

from __future__ import annotations

import os
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .auth import create_token, decode_token
from .google_identity import verify_google_credential
from .repository import ArcadeRepository, get_repository
from .schemas import (
    AuthResponse,
    GoogleExchangeRequest,
    NeonScoreCreate,
    NeonScoreResponse,
    NeonStatsResponse,
    TetrisScoreCreate,
    TetrisScoreResponse,
    TetrisStatsResponse,
    UserResponse,
)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
LOCAL_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3003",
    "http://127.0.0.1:3003",
]
CONFIGURED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ARCADE_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
ALLOWED_ORIGINS = list(dict.fromkeys([*LOCAL_ORIGINS, *CONFIGURED_ORIGINS]))

app = FastAPI(title="Jeremy Demers Arcade API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def user_response(user: dict[str, Any]) -> UserResponse:
    return UserResponse(
        id=str(user["id"]),
        username=str(user["username"]),
        picture_url=user.get("picture_url"),
    )


def current_user(
    authorization: str | None = Header(default=None),
    repository: ArcadeRepository = Depends(get_repository),
) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    payload = decode_token(authorization.removeprefix("Bearer ").strip())
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = repository.get_user(payload["sub"])
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user")
    return {**user, "subject": payload["sub"]}


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "arcade-api", "status": "ok"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/google", response_model=AuthResponse)
def google_exchange(
    payload: GoogleExchangeRequest,
    repository: ArcadeRepository = Depends(get_repository),
) -> AuthResponse:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    try:
        identity = verify_google_credential(payload.credential, GOOGLE_CLIENT_ID)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid Google credential") from exc

    user = repository.upsert_google_user(identity)
    return AuthResponse(
        token=create_token(str(identity["sub"]), str(user["username"])),
        user=user_response(user),
    )


@app.get("/me", response_model=UserResponse)
def me(user: dict[str, Any] = Depends(current_user)) -> UserResponse:
    return user_response(user)


@app.get("/games/tetris/leaderboard", response_model=list[TetrisScoreResponse])
def tetris_leaderboard(
    repository: ArcadeRepository = Depends(get_repository),
) -> list[TetrisScoreResponse]:
    return [TetrisScoreResponse(**item) for item in repository.leaderboard("tetris")]


@app.post(
    "/games/tetris/scores",
    response_model=TetrisScoreResponse,
    status_code=status.HTTP_201_CREATED,
)
def save_tetris_score(
    payload: TetrisScoreCreate,
    user: dict[str, Any] = Depends(current_user),
    repository: ArcadeRepository = Depends(get_repository),
) -> TetrisScoreResponse:
    item = repository.save_score(
        subject=user["subject"],
        username=user["username"],
        game_slug="tetris",
        score=payload.score,
        level=payload.level,
        metric_name="lines",
        metric_value=payload.lines,
    )
    return TetrisScoreResponse(**item)


@app.get("/games/tetris/stats", response_model=TetrisStatsResponse)
def tetris_stats(
    user: dict[str, Any] = Depends(current_user),
    repository: ArcadeRepository = Depends(get_repository),
) -> TetrisStatsResponse:
    return TetrisStatsResponse(**repository.stats(user["subject"], "tetris", "lines"))


@app.get("/games/neon-shatter/leaderboard", response_model=list[NeonScoreResponse])
def neon_leaderboard(
    repository: ArcadeRepository = Depends(get_repository),
) -> list[NeonScoreResponse]:
    return [NeonScoreResponse(**item) for item in repository.leaderboard("neon-shatter")]


@app.post(
    "/games/neon-shatter/scores",
    response_model=NeonScoreResponse,
    status_code=status.HTTP_201_CREATED,
)
def save_neon_score(
    payload: NeonScoreCreate,
    user: dict[str, Any] = Depends(current_user),
    repository: ArcadeRepository = Depends(get_repository),
) -> NeonScoreResponse:
    item = repository.save_score(
        subject=user["subject"],
        username=user["username"],
        game_slug="neon-shatter",
        score=payload.score,
        level=payload.level,
        metric_name="bricks",
        metric_value=payload.bricks,
    )
    return NeonScoreResponse(**item)


@app.get("/games/neon-shatter/stats", response_model=NeonStatsResponse)
def neon_stats(
    user: dict[str, Any] = Depends(current_user),
    repository: ArcadeRepository = Depends(get_repository),
) -> NeonStatsResponse:
    return NeonStatsResponse(
        **repository.stats(user["subject"], "neon-shatter", "bricks")
    )

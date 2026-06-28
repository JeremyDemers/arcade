from __future__ import annotations

from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    id: int
    username: str
    picture_url: str | None = None


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class GoogleExchangeRequest(BaseModel):
    credential: str = Field(min_length=20, max_length=10_000)


class ScoreCreate(BaseModel):
    score: int = Field(ge=0, le=10_000_000)
    level: int = Field(ge=1, le=99)
    lines: int = Field(ge=0, le=10_000)


class ScoreResponse(BaseModel):
    id: int
    username: str
    score: int
    level: int
    lines: int
    created_at: str


class StatsResponse(BaseModel):
    games_played: int
    best_score: int
    total_lines: int

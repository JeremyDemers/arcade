from __future__ import annotations

from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    id: str
    username: str
    picture_url: str | None = None


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class GoogleExchangeRequest(BaseModel):
    credential: str = Field(min_length=20, max_length=10_000)


class TetrisScoreCreate(BaseModel):
    score: int = Field(ge=0, le=10_000_000)
    level: int = Field(ge=1, le=99)
    lines: int = Field(ge=0, le=10_000)


class TetrisScoreResponse(TetrisScoreCreate):
    id: str
    username: str
    created_at: str


class TetrisStatsResponse(BaseModel):
    games_played: int
    best_score: int
    total_lines: int


class NeonScoreCreate(BaseModel):
    score: int = Field(ge=0, le=100_000_000)
    level: int = Field(ge=1, le=999)
    bricks: int = Field(ge=0, le=1_000_000)


class NeonScoreResponse(NeonScoreCreate):
    id: str
    username: str
    created_at: str


class NeonStatsResponse(BaseModel):
    games_played: int
    best_score: int
    total_bricks: int

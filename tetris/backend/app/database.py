from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "data" / "arcade.db"


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                external_provider TEXT,
                external_subject TEXT,
                picture_url TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                game_slug TEXT NOT NULL,
                score INTEGER NOT NULL CHECK(score >= 0),
                level INTEGER NOT NULL DEFAULT 1 CHECK(level >= 1),
                lines INTEGER NOT NULL DEFAULT 0 CHECK(lines >= 0),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_scores_game_score
                ON scores(game_slug, score DESC, created_at ASC);
            """
        )

        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(users)").fetchall()
        }
        if "external_provider" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN external_provider TEXT")
        if "external_subject" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN external_subject TEXT")
        if "picture_url" not in columns:
            conn.execute("ALTER TABLE users ADD COLUMN picture_url TEXT")

        conn.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external_identity
                ON users(external_provider, external_subject)
                WHERE external_provider IS NOT NULL AND external_subject IS NOT NULL
            """
        )

from __future__ import annotations

import hashlib
import os
import re
import uuid
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

GAME_LIMITS = {
    "tetris": 10_000_000,
    "neon-shatter": 100_000_000,
}


def public_user_id(subject: str) -> str:
    return hashlib.sha256(subject.encode("utf-8")).hexdigest()[:16]


def normalized_username(identity: dict[str, Any]) -> str:
    email = str(identity.get("email") or "")
    raw = str(identity.get("name") or email.partition("@")[0] or "player")
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "_", raw)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_").lower()
    return (cleaned or "player")[:24]


def leaderboard_key(game_slug: str, score: int, created_at: str, score_id: str) -> str:
    maximum = GAME_LIMITS[game_slug]
    return f"{maximum - score:012d}#{created_at}#{score_id}"


class ArcadeRepository:
    def __init__(self, table: Any):
        self.table = table

    def get_user(self, subject: str) -> dict[str, Any] | None:
        response = self.table.get_item(Key={"pk": f"USER#{subject}", "sk": "PROFILE"})
        return response.get("Item")

    def upsert_google_user(self, identity: dict[str, Any]) -> dict[str, Any]:
        subject = str(identity["sub"])
        picture_url = str(identity.get("picture") or "").strip() or None
        existing = self.get_user(subject)
        if existing:
            if picture_url != existing.get("picture_url"):
                self.table.update_item(
                    Key={"pk": f"USER#{subject}", "sk": "PROFILE"},
                    UpdateExpression="SET picture_url = :picture",
                    ExpressionAttributeValues={":picture": picture_url},
                )
                existing["picture_url"] = picture_url
            return existing

        user = {
            "pk": f"USER#{subject}",
            "sk": "PROFILE",
            "id": public_user_id(subject),
            "username": normalized_username(identity),
            "picture_url": picture_url,
            "created_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        }
        try:
            self.table.put_item(Item=user, ConditionExpression="attribute_not_exists(pk)")
            return user
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
                raise
            concurrent_user = self.get_user(subject)
            if not concurrent_user:
                raise
            return concurrent_user

    def save_score(
        self,
        *,
        subject: str,
        username: str,
        game_slug: str,
        score: int,
        level: int,
        metric_name: str,
        metric_value: int,
    ) -> dict[str, Any]:
        score_id = uuid.uuid4().hex
        created_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        item = {
            "pk": f"USER#{subject}",
            "sk": f"SCORE#{game_slug}#{created_at}#{score_id}",
            "id": score_id,
            "username": username,
            "game_slug": game_slug,
            "leaderboard_key": leaderboard_key(game_slug, score, created_at, score_id),
            "score": score,
            "level": level,
            metric_name: metric_value,
            "created_at": created_at,
        }
        self.table.put_item(Item=item)
        return item

    def leaderboard(self, game_slug: str) -> list[dict[str, Any]]:
        response = self.table.query(
            IndexName="game-leaderboard-index",
            KeyConditionExpression=Key("game_slug").eq(game_slug),
            ScanIndexForward=True,
            Limit=10,
        )
        return response.get("Items", [])

    def stats(self, subject: str, game_slug: str, metric_name: str) -> dict[str, int]:
        items: list[dict[str, Any]] = []
        query: dict[str, Any] = {
            "KeyConditionExpression": Key("pk").eq(f"USER#{subject}")
            & Key("sk").begins_with(f"SCORE#{game_slug}#")
        }

        while True:
            response = self.table.query(**query)
            items.extend(response.get("Items", []))
            if "LastEvaluatedKey" not in response:
                break
            query["ExclusiveStartKey"] = response["LastEvaluatedKey"]

        return {
            "games_played": len(items),
            "best_score": max((int(item["score"]) for item in items), default=0),
            f"total_{metric_name}": sum(int(item.get(metric_name, 0)) for item in items),
        }


@lru_cache(maxsize=1)
def get_repository() -> ArcadeRepository:
    table_name = os.getenv("ARCADE_TABLE_NAME", "").strip()
    if not table_name:
        raise RuntimeError("ARCADE_TABLE_NAME must be configured")
    return ArcadeRepository(boto3.resource("dynamodb").Table(table_name))

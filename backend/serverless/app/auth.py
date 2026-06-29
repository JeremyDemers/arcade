from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from functools import lru_cache
from typing import Any

import boto3

TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14


@lru_cache(maxsize=1)
def signing_secret() -> str:
    """Load the JWT signing secret locally or from Secrets Manager in AWS."""
    local_secret = os.getenv("ARCADE_SECRET", "").strip()
    if local_secret:
        return local_secret

    secret_arn = os.getenv("ARCADE_SECRET_ARN", "").strip()
    if not secret_arn:
        raise RuntimeError("ARCADE_SECRET or ARCADE_SECRET_ARN must be configured")

    response = boto3.client("secretsmanager").get_secret_value(SecretId=secret_arn)
    secret = response["SecretString"].strip()
    if len(secret) < 32:
        raise RuntimeError("The configured Arcade signing secret is too short")
    return secret


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def create_token(subject: str, username: str, *, secret: str | None = None) -> str:
    payload = {
        "sub": subject,
        "username": username,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    body = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new((secret or signing_secret()).encode(), body.encode(), hashlib.sha256).digest()
    return f"{body}.{_b64(signature)}"


def decode_token(token: str, *, secret: str | None = None) -> dict[str, Any] | None:
    try:
        body, signature = token.split(".", 1)
    except ValueError:
        return None

    expected = _b64(
        hmac.new((secret or signing_secret()).encode(), body.encode(), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(signature, expected):
        return None

    try:
        payload = json.loads(_unb64(body))
    except (json.JSONDecodeError, ValueError):
        return None

    if not isinstance(payload.get("sub"), str) or payload.get("exp", 0) < time.time():
        return None
    return payload

from __future__ import annotations

from typing import Any

from google.auth.transport import requests
from google.oauth2 import id_token


def verify_google_credential(credential: str, client_id: str) -> dict[str, Any]:
    """Verify a Google ID token's signature, audience, issuer, and expiration."""
    identity = id_token.verify_oauth2_token(credential, requests.Request(), client_id)
    if not identity.get("sub") or not identity.get("email_verified"):
        raise ValueError("Google account identity could not be verified")
    return identity

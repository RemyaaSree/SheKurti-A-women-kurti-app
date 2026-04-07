from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

from fastapi import HTTPException

TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60
SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "shekurti-dev-secret-key-change-me")


def sign_payload(payload_json: str) -> str:
    return hmac.new(
        SECRET_KEY.encode("utf-8"),
        payload_json.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def create_token(user: dict[str, Any]) -> tuple[str, str]:
    session_id = secrets.token_urlsafe(18)
    payload = {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "is_admin": bool(user.get("is_admin", False)),
        "sid": session_id,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    payload_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    payload_encoded = base64.urlsafe_b64encode(payload_json.encode("utf-8")).decode("utf-8")
    signature = sign_payload(payload_json)
    return f"{payload_encoded}.{signature}", session_id


def decode_token(token: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 2:
        raise HTTPException(status_code=401, detail="Invalid token")

    payload_encoded, signature = parts
    try:
        payload_json = base64.urlsafe_b64decode(payload_encoded.encode("utf-8")).decode("utf-8")
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    expected_signature = sign_payload(payload_json)
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=401, detail="Invalid token signature")

    payload = json.loads(payload_json)
    if int(payload.get("exp", 0)) < int(time.time()):
        raise HTTPException(status_code=401, detail="Token expired")
    return payload


def extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authorization must use Bearer token")
    return authorization[7:].strip()


def get_user_from_authorization(authorization: str | None) -> dict[str, Any]:
    token = extract_bearer_token(authorization)
    return decode_token(token)

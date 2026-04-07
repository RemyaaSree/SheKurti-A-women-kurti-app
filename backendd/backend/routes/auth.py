from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

try:
    from ..auth_utils import create_token, get_user_from_authorization
    from ..database import read_json, write_json
    from ..mysql_db import create_user, fetch_user_by_email, list_users_mysql, mysql_available
except ImportError:
    from auth_utils import create_token, get_user_from_authorization
    from database import read_json, write_json
    from mysql_db import create_user, fetch_user_by_email, list_users_mysql, mysql_available

router = APIRouter(prefix="/auth", tags=["auth"])

ADMIN_EMAIL = "admin@gmail.com"
ADMIN_PASSWORD = "adminadmin"
ADMIN_USER_ID = 0
ADMIN_NAME = "Admin"


class RegisterPayload(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=6, max_length=128)


class LoginPayload(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=6, max_length=128)


def _require_admin_user(authorization: str | None) -> dict[str, Any]:
    user = get_user_from_authorization(authorization)
    raw = user.get("is_admin", False)
    is_admin = raw if isinstance(raw, bool) else str(raw).strip().lower() in {"1", "true", "yes", "y"}
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _hash_password(password: str, salt: str) -> str:
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    )
    return password_hash.hex()


def _is_valid_email(email: str) -> bool:
    normalized = email.strip()
    if "@" not in normalized:
        return False
    local, _, domain = normalized.partition("@")
    return bool(local) and "." in domain and not domain.startswith(".") and not domain.endswith(".")


@router.post("/register")
def register(payload: RegisterPayload):
    if not _is_valid_email(payload.email):
        raise HTTPException(status_code=422, detail="Invalid email")

    email = payload.email.strip().lower()
    if mysql_available():
        if fetch_user_by_email(email):
            raise HTTPException(status_code=409, detail="Email already registered")
    else:
        users = read_json("users.json", default=[])
        if any(str(user.get("email", "")).lower() == email for user in users):
            raise HTTPException(status_code=409, detail="Email already registered")

    salt = secrets.token_hex(16)
    created_at = int(time.time())
    if mysql_available():
        user = create_user(
            name=payload.name.strip(),
            email=email,
            salt=salt,
            password_hash=_hash_password(payload.password, salt),
            created_at=created_at,
        )
        if not user:
            raise HTTPException(status_code=500, detail="Failed to create user")
    else:
        users = read_json("users.json", default=[])
        user = {
            "id": len(users) + 1,
            "name": payload.name.strip(),
            "email": email,
            "salt": salt,
            "password_hash": _hash_password(payload.password, salt),
            "created_at": created_at,
        }
        users.append(user)
        write_json("users.json", users)

    token, session_id = create_token(user)
    return {
        "token": token,
        "session_id": session_id,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "is_admin": bool(user.get("is_admin", False)),
        },
    }


@router.post("/login")
def login(payload: LoginPayload):
    if not _is_valid_email(payload.email):
        raise HTTPException(status_code=422, detail="Invalid email")

    email = payload.email.strip().lower()
    if mysql_available():
        user = fetch_user_by_email(email)
    else:
        users = read_json("users.json", default=[])
        user = next((entry for entry in users if str(entry.get("email", "")).lower() == email), None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    expected = _hash_password(payload.password, str(user.get("salt", "")))
    if not hmac.compare_digest(str(user.get("password_hash", "")), expected):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token, session_id = create_token(user)
    return {
        "token": token,
        "session_id": session_id,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "is_admin": bool(user.get("is_admin", False)),
        },
    }


@router.post("/admin/login")
def admin_login(payload: LoginPayload):
    if not _is_valid_email(payload.email):
        raise HTTPException(status_code=422, detail="Invalid email")

    email = payload.email.strip().lower()
    if email != ADMIN_EMAIL or payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    admin_user = {
        "id": ADMIN_USER_ID,
        "name": ADMIN_NAME,
        "email": ADMIN_EMAIL,
        "is_admin": True,
    }
    token, session_id = create_token(admin_user)
    return {
        "token": token,
        "session_id": session_id,
        "user": {
            "id": admin_user["id"],
            "name": admin_user["name"],
            "email": admin_user["email"],
            "is_admin": True,
        },
    }


@router.get("/me")
def me(authorization: str | None = Header(default=None)):
    payload = get_user_from_authorization(authorization)
    return {
        "user": {
            "id": payload["id"],
            "name": payload["name"],
            "email": payload["email"],
            "is_admin": bool(payload.get("is_admin", False)),
        },
        "session_id": payload.get("sid"),
    }


@router.get("/admin/users")
def admin_users(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    _require_admin_user(authorization)
    if mysql_available():
        return list_users_mysql()

    users = read_json("users.json", default=[])
    if not isinstance(users, list):
        return []
    results: list[dict[str, Any]] = []
    for entry in users:
        if not isinstance(entry, dict):
            continue
        results.append(
            {
                "id": entry.get("id"),
                "name": entry.get("name"),
                "email": entry.get("email"),
                "created_at": entry.get("created_at"),
                "is_admin": bool(entry.get("is_admin", False)),
            }
        )
    return results

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

try:
    from ..auth_utils import get_user_from_authorization
    from ..database import read_json, write_json
    from ..mysql_db import (
        create_contact_message_mysql,
        list_blog_mysql,
        list_contact_messages_admin_mysql,
        list_contact_messages_for_user_mysql,
        list_faqs_mysql,
        mysql_available,
    )
except ImportError:
    from auth_utils import get_user_from_authorization
    from database import read_json, write_json
    from mysql_db import (
        create_contact_message_mysql,
        list_blog_mysql,
        list_contact_messages_admin_mysql,
        list_contact_messages_for_user_mysql,
        list_faqs_mysql,
        mysql_available,
    )

router = APIRouter(prefix="/pages", tags=["pages"])


def _require_admin_user(authorization: str | None) -> dict:
    user = get_user_from_authorization(authorization)
    raw = user.get("is_admin", False)
    is_admin = raw if isinstance(raw, bool) else str(raw).strip().lower() in {"1", "true", "yes", "y"}
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class ContactPayload(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=254)
    phone: str | None = None
    subject: str = Field(min_length=2, max_length=150)
    message: str = Field(min_length=3, max_length=2000)


@router.get("/blog")
def get_blog() -> list[dict[str, Any]]:
    if mysql_available():
        return list_blog_mysql()
    return read_json("blog.json", default=[])


@router.get("/faqs")
def get_faqs() -> list[dict[str, Any]]:
    if mysql_available():
        return list_faqs_mysql()
    return read_json("faqs.json", default=[])


@router.post("/contact")
def post_contact(payload: ContactPayload, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user: dict[str, Any] | None = None
    if authorization:
        try:
            user = get_user_from_authorization(authorization)
        except HTTPException:
            user = None

    if mysql_available():
        created = create_contact_message_mysql(
            user_id=int(user.get("id")) if user else None,
            session_id=str(user.get("sid")) if user else None,
            name=payload.name,
            email=payload.email,
            phone=payload.phone,
            subject=payload.subject,
            message=payload.message,
        )
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create message")
        return {"success": True, "message": "Message received", "data": created}

    messages = read_json("contact_messages.json", default=[])
    if not isinstance(messages, list):
        messages = []

    entry = {
        "id": len(messages) + 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "user_id": user.get("id") if user else None,
        "session_id": user.get("sid") if user else None,
        **payload.model_dump(),
    }
    messages.append(entry)
    write_json("contact_messages.json", messages)
    return {"success": True, "message": "Message received", "data": entry}


@router.get("/contact")
def get_my_contacts(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    user = get_user_from_authorization(authorization)
    user_id = user.get("id")

    if mysql_available():
        return list_contact_messages_for_user_mysql(int(user_id))

    messages = read_json("contact_messages.json", default=[])
    if not isinstance(messages, list):
        return []

    own_messages = [entry for entry in messages if entry.get("user_id") == user_id]
    return sorted(
        own_messages,
        key=lambda item: str(item.get("created_at", "")),
        reverse=True,
    )


@router.get("/admin/contact")
def get_all_contacts(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    _require_admin_user(authorization)

    if mysql_available():
        return list_contact_messages_admin_mysql()

    messages = read_json("contact_messages.json", default=[])
    if not isinstance(messages, list):
        return []

    return sorted(
        messages,
        key=lambda item: str(item.get("created_at", "")),
        reverse=True,
    )

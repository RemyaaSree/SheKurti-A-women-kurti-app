from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

try:
    from ..auth_utils import get_user_from_authorization
    from ..database import read_json, write_json
    from ..mysql_db import create_address_mysql, delete_address_mysql, list_addresses_mysql, mysql_available, update_address_mysql
except ImportError:
    from auth_utils import get_user_from_authorization
    from database import read_json, write_json
    from mysql_db import create_address_mysql, delete_address_mysql, list_addresses_mysql, mysql_available, update_address_mysql

router = APIRouter(prefix="/profile", tags=["profile"])


class AddressPayload(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    line1: str = Field(min_length=3, max_length=200)
    line2: str | None = Field(default=None, max_length=200)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=80)
    postal_code: str = Field(min_length=3, max_length=20)
    country: str = Field(min_length=2, max_length=80)


def _get_store() -> dict[str, list[dict[str, Any]]]:
    raw = read_json("addresses.json", default={})
    if isinstance(raw, dict):
        return raw
    return {}


def _save_store(store: dict[str, list[dict[str, Any]]]) -> None:
    write_json("addresses.json", store)


def _get_user_addresses(user_id: int) -> list[dict[str, Any]]:
    if mysql_available():
        return list_addresses_mysql(user_id)
    return _get_store().get(str(user_id), [])


def _set_user_addresses(user_id: int, addresses: list[dict[str, Any]]) -> None:
    store = _get_store()
    store[str(user_id)] = addresses
    _save_store(store)


@router.get("/addresses")
def get_addresses(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = get_user_from_authorization(authorization)
    return _get_user_addresses(int(user["id"]))


@router.post("/addresses")
def create_address(
    payload: AddressPayload,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_user_from_authorization(authorization)
    user_id = int(user["id"])
    if mysql_available():
        created = create_address_mysql(user_id, payload.model_dump())
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create address")
        return created

    addresses = _get_user_addresses(user_id)
    next_id = max((int(entry.get("id", 0)) for entry in addresses), default=0) + 1

    entry = {"id": next_id, **payload.model_dump()}
    addresses.append(entry)
    _set_user_addresses(user_id, addresses)
    return entry


@router.put("/addresses/{address_id}")
def update_address(
    address_id: int,
    payload: AddressPayload,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_user_from_authorization(authorization)
    user_id = int(user["id"])
    if mysql_available():
        updated = update_address_mysql(user_id, address_id, payload.model_dump())
        if not updated:
            raise HTTPException(status_code=404, detail="Address not found")
        return updated

    addresses = _get_user_addresses(user_id)
    index = next((idx for idx, entry in enumerate(addresses) if entry.get("id") == address_id), None)
    if index is None:
        raise HTTPException(status_code=404, detail="Address not found")

    updated = {"id": address_id, **payload.model_dump()}
    addresses[index] = updated
    _set_user_addresses(user_id, addresses)
    return updated


@router.delete("/addresses/{address_id}")
def delete_address(address_id: int, authorization: str | None = Header(default=None)) -> dict[str, bool]:
    user = get_user_from_authorization(authorization)
    user_id = int(user["id"])
    if mysql_available():
        if not delete_address_mysql(user_id, address_id):
            raise HTTPException(status_code=404, detail="Address not found")
        return {"success": True}

    addresses = _get_user_addresses(user_id)
    updated = [entry for entry in addresses if entry.get("id") != address_id]
    if len(updated) == len(addresses):
        raise HTTPException(status_code=404, detail="Address not found")
    _set_user_addresses(user_id, updated)
    return {"success": True}

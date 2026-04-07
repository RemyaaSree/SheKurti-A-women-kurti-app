from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

try:
    from ..auth_utils import get_user_from_authorization
    from ..database import read_json, write_json
    from ..mysql_db import (
        delete_cart_item_mysql,
        list_bottomwear_mysql,
        list_dupatta_mysql,
        list_cart_items_mysql,
        list_products_mysql,
        mysql_available,
        update_cart_item_mysql,
        upsert_cart_item_mysql,
    )
    from .products import _build_all_dynamic_section_products
except ImportError:
    from auth_utils import get_user_from_authorization
    from database import read_json, write_json
    from mysql_db import (
        delete_cart_item_mysql,
        list_bottomwear_mysql,
        list_dupatta_mysql,
        list_cart_items_mysql,
        list_products_mysql,
        mysql_available,
        update_cart_item_mysql,
        upsert_cart_item_mysql,
    )
    from routes.products import _build_all_dynamic_section_products

router = APIRouter(prefix="/cart", tags=["cart"])


class CartItemPayload(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


class CartQuantityPayload(BaseModel):
    quantity: int = Field(gt=0)


def _ensure_product_exists(product_id: int) -> None:
    if mysql_available():
        products = list_products_mysql() + list_bottomwear_mysql() + list_dupatta_mysql()
    else:
        products = read_json("products.json", default=[])
        bottomwear = read_json("bottomwear_products.json", default=[])
        if isinstance(bottomwear, list):
            products = products + bottomwear
        dupatta = read_json("dupatta_products.json", default=[])
        if isinstance(dupatta, list):
            products = products + dupatta
    dynamic_products = _build_all_dynamic_section_products(products)
    all_products = products + dynamic_products
    exists = any(int(product.get("id", 0) or 0) == product_id for product in all_products)
    if not exists:
        raise HTTPException(status_code=404, detail="Product not found")


def _get_cart_store() -> dict[str, list[dict[str, Any]]]:
    raw = read_json("cart.json", default={})
    if isinstance(raw, dict):
        return raw
    return {}


def _save_cart_store(store: dict[str, list[dict[str, Any]]]) -> None:
    write_json("cart.json", store)


def _get_user_cart(user_id: int) -> list[dict[str, Any]]:
    if mysql_available():
        return list_cart_items_mysql(user_id)
    store = _get_cart_store()
    return store.get(str(user_id), [])


def _set_user_cart(user_id: int, items: list[dict[str, Any]]) -> None:
    store = _get_cart_store()
    store[str(user_id)] = items
    _save_cart_store(store)


@router.get("/")
def get_cart(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = get_user_from_authorization(authorization)
    return _get_user_cart(int(user["id"]))


@router.post("/")
def add_to_cart(payload: CartItemPayload, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = get_user_from_authorization(authorization)
    _ensure_product_exists(payload.product_id)

    if mysql_available():
        current_cart = list_cart_items_mysql(int(user["id"]))
        existing = next((item for item in current_cart if item.get("product_id") == payload.product_id), None)
        new_qty = payload.quantity + int(existing.get("quantity", 0) if existing else 0)
        saved = upsert_cart_item_mysql(int(user["id"]), payload.product_id, new_qty)
        if not saved:
            raise HTTPException(status_code=500, detail="Failed to update cart")
        return saved

    cart = _get_user_cart(int(user["id"]))
    existing = next((item for item in cart if item.get("product_id") == payload.product_id), None)

    if existing:
        existing["quantity"] = int(existing.get("quantity", 0)) + payload.quantity
        _set_user_cart(int(user["id"]), cart)
        return existing

    new_item = payload.model_dump()
    cart.append(new_item)
    _set_user_cart(int(user["id"]), cart)
    return new_item


@router.put("/{product_id}")
def update_cart_item(
    product_id: int,
    payload: CartQuantityPayload,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_user_from_authorization(authorization)
    if mysql_available():
        updated = update_cart_item_mysql(int(user["id"]), product_id, payload.quantity)
        if not updated:
            raise HTTPException(status_code=404, detail="Cart item not found")
        return updated

    cart = _get_user_cart(int(user["id"]))
    existing = next((item for item in cart if item.get("product_id") == product_id), None)

    if not existing:
        raise HTTPException(status_code=404, detail="Cart item not found")

    existing["quantity"] = payload.quantity
    _set_user_cart(int(user["id"]), cart)
    return existing


@router.delete("/{product_id}")
def remove_cart_item(product_id: int, authorization: str | None = Header(default=None)) -> dict[str, bool]:
    user = get_user_from_authorization(authorization)
    if mysql_available():
        if not delete_cart_item_mysql(int(user["id"]), product_id):
            raise HTTPException(status_code=404, detail="Cart item not found")
        return {"success": True}

    cart = _get_user_cart(int(user["id"]))
    updated = [item for item in cart if item.get("product_id") != product_id]

    if len(updated) == len(cart):
        raise HTTPException(status_code=404, detail="Cart item not found")

    _set_user_cart(int(user["id"]), updated)
    return {"success": True}

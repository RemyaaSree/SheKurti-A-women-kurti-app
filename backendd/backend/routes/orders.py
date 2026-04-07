from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

try:
    from ..auth_utils import get_user_from_authorization
    from ..database import read_json, write_json
    from ..mysql_db import (
        clear_cart_mysql,
        create_order_mysql,
        get_order_mysql,
        list_addresses_mysql,
        list_cart_items_mysql,
        list_orders_admin_mysql,
        list_orders_mysql,
        list_users_mysql,
        mysql_available,
    )
    from .products import (
        _build_all_dynamic_section_products,
        _load_base_products,
        _load_bottomwear_products,
        _load_dupatta_products,
    )
except ImportError:
    from auth_utils import get_user_from_authorization
    from database import read_json, write_json
    from mysql_db import (
        clear_cart_mysql,
        create_order_mysql,
        get_order_mysql,
        list_addresses_mysql,
        list_cart_items_mysql,
        list_orders_admin_mysql,
        list_orders_mysql,
        list_users_mysql,
        mysql_available,
    )
    from routes.products import (
        _build_all_dynamic_section_products,
        _load_base_products,
        _load_bottomwear_products,
        _load_dupatta_products,
    )

router = APIRouter(prefix="/orders", tags=["orders"])
ALLOWED_PAYMENT_METHODS = {
    "debit_card",
    "credit_card",
    "net_banking",
    "upi_gpay",
    "upi_paytm",
    "upi_phonepe",
    "cod",
}


class CheckoutItem(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


class CheckoutPayload(BaseModel):
    items: list[CheckoutItem] | None = None
    address_id: int | None = Field(default=None, gt=0)
    shipping_address: dict[str, str] | None = None
    payment_method: str = Field(default="card", min_length=2, max_length=40)
    payment_details: dict[str, str] | None = None
    notes: str | None = Field(default=None, max_length=500)


def _get_orders_store() -> dict[str, list[dict[str, Any]]]:
    raw = read_json("orders.json", default={})
    if isinstance(raw, dict):
        return raw
    return {}


def _save_orders_store(store: dict[str, list[dict[str, Any]]]) -> None:
    write_json("orders.json", store)


def _get_user_orders(user_id: int) -> list[dict[str, Any]]:
    if mysql_available():
        return list_orders_mysql(user_id)
    return _get_orders_store().get(str(user_id), [])


def _set_user_orders(user_id: int, orders: list[dict[str, Any]]) -> None:
    store = _get_orders_store()
    store[str(user_id)] = orders
    _save_orders_store(store)


def _get_cart_store() -> dict[str, list[dict[str, Any]]]:
    raw = read_json("cart.json", default={})
    if isinstance(raw, dict):
        return raw
    return {}


def _save_cart_store(store: dict[str, list[dict[str, Any]]]) -> None:
    write_json("cart.json", store)


def _get_address_store() -> dict[str, list[dict[str, Any]]]:
    raw = read_json("addresses.json", default={})
    if isinstance(raw, dict):
        return raw
    return {}

def _require_admin_user(authorization: str | None) -> dict[str, Any]:
    user = get_user_from_authorization(authorization)
    raw = user.get("is_admin", False)
    is_admin = raw if isinstance(raw, bool) else str(raw).strip().lower() in {"1", "true", "yes", "y"}
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _build_users_lookup() -> dict[int, dict[str, Any]]:
    lookup: dict[int, dict[str, Any]] = {}
    if mysql_available():
        for entry in list_users_mysql():
            user_id = int(entry.get("id", 0) or 0)
            if user_id <= 0:
                continue
            lookup[user_id] = {
                "name": entry.get("name"),
                "email": entry.get("email"),
            }
        return lookup

    users = read_json("users.json", default=[])
    if not isinstance(users, list):
        return lookup
    for entry in users:
        if not isinstance(entry, dict):
            continue
        try:
            user_id = int(entry.get("id", 0))
        except (TypeError, ValueError):
            continue
        if user_id <= 0:
            continue
        lookup[user_id] = {
            "name": entry.get("name"),
            "email": entry.get("email"),
        }
    return lookup


def _find_product(product_id: int) -> dict[str, Any] | None:
    products = _load_base_products() + _load_bottomwear_products() + _load_dupatta_products()
    product = next((item for item in products if int(item.get("id", 0) or 0) == product_id), None)
    if product is not None:
        return product
    dynamic_products = _build_all_dynamic_section_products(products)
    return next((item for item in dynamic_products if int(item.get("id", 0) or 0) == product_id), None)


def _build_order_id(existing_orders: list[dict[str, Any]]) -> str:
    suffix = len(existing_orders) + 1
    return f"SK-{int(time.time()) % 100000:05d}{suffix:02d}"


def _build_tracking_events(created_at: datetime, status: str) -> list[dict[str, Any]]:
    status_order = ["Processing", "Confirmed", "Shipped", "Out for Delivery", "Delivered"]
    current_index = status_order.index(status) if status in status_order else 0
    stages = [
        "Order Placed",
        "Confirmed",
        "Shipped",
        "Out for Delivery",
        "Delivered",
    ]
    events: list[dict[str, Any]] = []
    for index, stage in enumerate(stages):
        event_status = "completed" if index <= current_index else "pending"
        event_time = (created_at + timedelta(hours=index * 12)).isoformat() if event_status == "completed" else None
        events.append({"stage": stage, "status": event_status, "timestamp": event_time})
    return events


def _normalize_manual_address(raw_address: dict[str, str] | None) -> dict[str, str] | None:
    if raw_address is None:
        return None
    required_keys = ["full_name", "phone", "line1", "city", "state", "postal_code", "country"]
    normalized = {key: str(raw_address.get(key, "")).strip() for key in required_keys}
    if any(not value for value in normalized.values()):
        raise HTTPException(status_code=422, detail="Manual address is incomplete")
    normalized["line2"] = str(raw_address.get("line2", "")).strip()
    return normalized


def _sanitize_payment_details(payment_method: str, payment_details: dict[str, str] | None) -> dict[str, str]:
    details = payment_details or {}

    if payment_method in {"debit_card", "credit_card"}:
        card_number = "".join(ch for ch in str(details.get("card_number", "")) if ch.isdigit())
        cardholder_name = str(details.get("cardholder_name", "")).strip()
        expiry_month = str(details.get("expiry_month", "")).strip()
        expiry_year = str(details.get("expiry_year", "")).strip()
        cvv = str(details.get("cvv", "")).strip()

        if len(card_number) < 12 or len(card_number) > 19:
            raise HTTPException(status_code=422, detail="Invalid card number")
        if not cardholder_name:
            raise HTTPException(status_code=422, detail="Cardholder name is required")
        if not (expiry_month.isdigit() and 1 <= int(expiry_month) <= 12):
            raise HTTPException(status_code=422, detail="Invalid expiry month")
        if not (expiry_year.isdigit() and len(expiry_year) in {2, 4}):
            raise HTTPException(status_code=422, detail="Invalid expiry year")
        if not (cvv.isdigit() and len(cvv) in {3, 4}):
            raise HTTPException(status_code=422, detail="Invalid CVV")

        masked = f"**** **** **** {card_number[-4:]}"
        return {
            "cardholder_name": cardholder_name,
            "masked_card_number": masked,
            "expiry": f"{int(expiry_month):02d}/{expiry_year[-2:]}",
        }

    if payment_method in {"upi_gpay", "upi_paytm", "upi_phonepe"}:
        upi_id = str(details.get("upi_id", "")).strip().lower()
        if "@" not in upi_id or upi_id.startswith("@") or upi_id.endswith("@"):
            raise HTTPException(status_code=422, detail="Invalid UPI ID")
        return {"upi_id": upi_id}

    if payment_method == "net_banking":
        bank_name = str(details.get("bank_name", "")).strip()
        account_holder = str(details.get("account_holder", "")).strip()
        if not bank_name:
            raise HTTPException(status_code=422, detail="Bank name is required")
        if not account_holder:
            raise HTTPException(status_code=422, detail="Account holder name is required")
        return {"bank_name": bank_name, "account_holder": account_holder}

    return {}


@router.get("/")
def get_orders(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = get_user_from_authorization(authorization)
    orders = _get_user_orders(int(user["id"]))
    return sorted(orders, key=lambda entry: entry.get("created_at", ""), reverse=True)


@router.get("/{order_id}")
def get_order(order_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = get_user_from_authorization(authorization)
    if mysql_available():
        order = get_order_mysql(int(user["id"]), order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return order

    orders = _get_user_orders(int(user["id"]))
    order = next((entry for entry in orders if entry.get("id") == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/admin/all")
def admin_list_orders(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    _require_admin_user(authorization)
    if mysql_available():
        users_lookup = _build_users_lookup()
        orders = list_orders_admin_mysql()
        for entry in orders:
            user_id = int(entry.get("user_id", 0) or 0)
            user_meta = users_lookup.get(user_id, {})
            entry["user_name"] = user_meta.get("name")
            entry["user_email"] = user_meta.get("email")
        return sorted(orders, key=lambda item: item.get("created_at", ""), reverse=True)

    store = _get_orders_store()
    users_lookup = _build_users_lookup()
    orders: list[dict[str, Any]] = []
    if not isinstance(store, dict):
        return orders
    for user_key, user_orders in store.items():
        if not isinstance(user_orders, list):
            continue
        user_id: int | None = None
        try:
            user_id = int(user_key)
        except (TypeError, ValueError):
            user_id = None
        user_meta = users_lookup.get(user_id or 0, {})
        for entry in user_orders:
            if not isinstance(entry, dict):
                continue
            payload = dict(entry)
            payload["user_id"] = user_id if user_id is not None else user_key
            payload["user_name"] = user_meta.get("name")
            payload["user_email"] = user_meta.get("email")
            orders.append(payload)
    return sorted(orders, key=lambda item: item.get("created_at", ""), reverse=True)


@router.post("/checkout")
def checkout(payload: CheckoutPayload, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = get_user_from_authorization(authorization)
    user_id = int(user["id"])
    if payload.payment_method not in ALLOWED_PAYMENT_METHODS:
        raise HTTPException(status_code=422, detail="Unsupported payment method")
    sanitized_payment_details = _sanitize_payment_details(payload.payment_method, payload.payment_details)

    if mysql_available():
        checkout_items = payload.items or list_cart_items_mysql(user_id)
    else:
        cart_store = _get_cart_store()
        checkout_items = payload.items or cart_store.get(str(user_id), [])
    if not checkout_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    selected_address_id: int | None = None
    shipping_address: dict[str, Any] | None = None
    if mysql_available():
        address_store = list_addresses_mysql(user_id)
    else:
        address_store = _get_address_store().get(str(user_id), [])

    if payload.address_id is not None and payload.shipping_address is not None:
        raise HTTPException(status_code=422, detail="Choose either saved address or manual address")

    if payload.address_id is not None:
        selected = next((entry for entry in address_store if entry.get("id") == payload.address_id), None)
        if not selected:
            raise HTTPException(status_code=404, detail="Address not found")
        selected_address_id = payload.address_id
        shipping_address = {
            "full_name": selected.get("full_name", ""),
            "phone": selected.get("phone", ""),
            "line1": selected.get("line1", ""),
            "line2": selected.get("line2", ""),
            "city": selected.get("city", ""),
            "state": selected.get("state", ""),
            "postal_code": selected.get("postal_code", ""),
            "country": selected.get("country", ""),
        }

    if payload.shipping_address is not None:
        shipping_address = _normalize_manual_address(payload.shipping_address)

    if shipping_address is None:
        raise HTTPException(status_code=422, detail="Delivery address is required")

    items: list[dict[str, Any]] = []
    total_amount = 0.0

    for raw_item in checkout_items:
        product_id = int(raw_item.get("product_id", 0))
        quantity = int(raw_item.get("quantity", 0))
        if product_id <= 0 or quantity <= 0:
            raise HTTPException(status_code=422, detail="Invalid checkout items")

        product = _find_product(product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found")

        price = float(product.get("price", 0))
        line_total = price * quantity
        total_amount += line_total

        items.append(
            {
                "product_id": product_id,
                "product_name": product.get("name"),
                "unit_price": price,
                "quantity": quantity,
                "line_total": line_total,
            }
        )

    user_orders = _get_user_orders(user_id)
    created_at = datetime.now(timezone.utc)
    order_status = "Processing"
    order = {
        "id": _build_order_id(user_orders),
        "status": order_status,
        "created_at": created_at.isoformat(),
        "payment_method": payload.payment_method,
        "payment_details": sanitized_payment_details,
        "address_id": selected_address_id,
        "shipping_address": shipping_address,
        "notes": payload.notes,
        "currency": "INR",
        "items": items,
        "total_amount": round(total_amount, 2),
        "expected_delivery_at": (created_at + timedelta(days=5)).isoformat(),
        "tracking_events": _build_tracking_events(created_at, order_status),
    }
    if mysql_available():
        order["user_id"] = user_id
        created = create_order_mysql(order)
        if not created:
            raise HTTPException(status_code=500, detail="Failed to create order")
        clear_cart_mysql(user_id)
        return {"success": True, "order": created}

    user_orders.append(order)
    _set_user_orders(user_id, user_orders)

    cart_store = _get_cart_store()
    cart_store[str(user_id)] = []
    _save_cart_store(cart_store)

    return {"success": True, "order": order}

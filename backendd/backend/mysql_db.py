from __future__ import annotations

import json
import os
import random
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote, quote_plus

_engine: Any = None
_session_maker: Any = None
_init_error: str | None = None


def _import_sqlalchemy():
    try:
        from sqlalchemy import create_engine, text
        from sqlalchemy.orm import sessionmaker
    except Exception as exc:
        raise RuntimeError(
            "SQLAlchemy dependencies are missing. Install: pip install sqlalchemy pymysql"
        ) from exc
    return create_engine, text, sessionmaker


def _database_url() -> str:
    # Supports either DATABASE_URL or individual DB_* env vars.
    custom_url = os.getenv("DATABASE_URL")
    if custom_url:
        return custom_url

    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "remyaa")
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = os.getenv("DB_PORT", "3306")
    name = os.getenv("DB_NAME", "shekurti")
    return f"mysql+pymysql://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{quote_plus(name)}?charset=utf8mb4"


def _server_database_url() -> str:
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "remyaa")
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = os.getenv("DB_PORT", "3306")
    return f"mysql+pymysql://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/?charset=utf8mb4"


def _ensure_engine() -> tuple[Any, Any] | None:
    global _engine, _session_maker, _init_error

    if _engine is not None and _session_maker is not None:
        return _engine, _session_maker
    if _init_error:
        return None

    try:
        create_engine, _, sessionmaker = _import_sqlalchemy()
        _engine = create_engine(
            _database_url(),
            pool_pre_ping=True,
            future=True,
            connect_args={
                "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "5")),
                "read_timeout": int(os.getenv("DB_READ_TIMEOUT", "10")),
                "write_timeout": int(os.getenv("DB_WRITE_TIMEOUT", "10")),
            },
        )
        _session_maker = sessionmaker(bind=_engine, autoflush=False, autocommit=False, future=True)
    except Exception as exc:
        _init_error = str(exc)
        return None

    return _engine, _session_maker


def mysql_available() -> bool:
    return _ensure_engine() is not None


def mysql_error() -> str | None:
    _ensure_engine()
    return _init_error


def mysql_ping() -> tuple[bool, str]:
    setup = _ensure_engine()
    if setup is None:
        return False, _init_error or "MySQL engine is not initialized"

    engine, _ = setup
    _, text, _ = _import_sqlalchemy()

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, ""
    except Exception as exc:
        return False, str(exc)


def init_mysql_schema() -> None:
    global _engine, _session_maker, _init_error

    create_engine, text, _ = _import_sqlalchemy()
    db_name = os.getenv("DB_NAME", "shekurti")

    try:
        server_engine = create_engine(
            _server_database_url(),
            pool_pre_ping=True,
            future=True,
            connect_args={
                "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "5")),
                "read_timeout": int(os.getenv("DB_READ_TIMEOUT", "10")),
                "write_timeout": int(os.getenv("DB_WRITE_TIMEOUT", "10")),
            },
        )
        with server_engine.begin() as conn:
            conn.execute(
                text(
                    f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
            )
        server_engine.dispose()

        app_engine = create_engine(
            _database_url(),
            pool_pre_ping=True,
            future=True,
            connect_args={
                "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "5")),
                "read_timeout": int(os.getenv("DB_READ_TIMEOUT", "10")),
                "write_timeout": int(os.getenv("DB_WRITE_TIMEOUT", "10")),
            },
        )
        with app_engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id BIGINT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        email VARCHAR(254) NOT NULL UNIQUE,
                        salt VARCHAR(64) NOT NULL,
                        password_hash VARCHAR(128) NOT NULL,
                        is_admin TINYINT(1) NOT NULL DEFAULT 0,
                        created_at BIGINT NOT NULL
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
            try:
                conn.execute(
                    text(
                        """
                        ALTER TABLE users
                        ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0
                        """
                    )
                )
            except Exception:
                # Column already exists on upgraded databases.
                pass
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS products (
                        id BIGINT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        price DECIMAL(10,2) NOT NULL,
                        original_price DECIMAL(10,2) NOT NULL,
                        image_url TEXT NOT NULL,
                        category VARCHAR(120) NOT NULL,
                        color VARCHAR(80) NOT NULL,
                        material VARCHAR(120) NOT NULL,
                        sizes_json JSON NOT NULL,
                        rating DECIMAL(3,2) NOT NULL,
                        reviews INT NOT NULL,
                        description TEXT NOT NULL,
                        created_at BIGINT NOT NULL,
                        product_type VARCHAR(32) NOT NULL DEFAULT 'kurti'
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
            try:
                conn.execute(
                    text(
                        """
                        ALTER TABLE products
                        ADD COLUMN product_type VARCHAR(32) NOT NULL DEFAULT 'kurti'
                        """
                    )
                )
            except Exception:
                # Column already exists on upgraded databases.
                pass
            # Migrate legacy bottomwear table into products, then drop it.
            try:
                conn.execute(
                    text(
                        """
                        INSERT IGNORE INTO products (
                            id, name, price, original_price, image_url, category, color, material, sizes_json, rating, reviews, description, created_at, product_type
                        )
                        SELECT
                            id, name, price, original_price, image_url, category, color, material, sizes_json, rating, reviews, description, created_at, 'bottomwear'
                        FROM bottomwear_products
                        """
                    )
                )
                conn.execute(text("DROP TABLE IF EXISTS bottomwear_products"))
            except Exception:
                # Table may not exist; ignore migration errors.
                pass
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS contact_messages (
                        id BIGINT AUTO_INCREMENT PRIMARY KEY,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        user_id BIGINT NULL,
                        session_id VARCHAR(128) NULL,
                        name VARCHAR(100) NOT NULL,
                        email VARCHAR(254) NOT NULL,
                        phone VARCHAR(40) NULL,
                        subject VARCHAR(150) NOT NULL,
                        message TEXT NOT NULL,
                        INDEX idx_contact_user_id (user_id),
                        INDEX idx_contact_created_at (created_at)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS blog_posts (
                        id BIGINT PRIMARY KEY,
                        title VARCHAR(255) NOT NULL,
                        excerpt TEXT NOT NULL,
                        category VARCHAR(80) NOT NULL,
                        date DATE NOT NULL
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS faqs (
                        id BIGINT PRIMARY KEY,
                        question TEXT NOT NULL,
                        answer TEXT NOT NULL
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS addresses (
                        user_id BIGINT NOT NULL,
                        id BIGINT NOT NULL,
                        full_name VARCHAR(120) NOT NULL,
                        phone VARCHAR(20) NOT NULL,
                        line1 VARCHAR(200) NOT NULL,
                        line2 VARCHAR(200) NULL,
                        city VARCHAR(80) NOT NULL,
                        state VARCHAR(80) NOT NULL,
                        postal_code VARCHAR(20) NOT NULL,
                        country VARCHAR(80) NOT NULL,
                        created_at BIGINT NOT NULL,
                        PRIMARY KEY (user_id, id),
                        INDEX idx_addresses_user_id (user_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS cart_items (
                        user_id BIGINT NOT NULL,
                        product_id BIGINT NOT NULL,
                        quantity INT NOT NULL,
                        updated_at BIGINT NOT NULL,
                        PRIMARY KEY (user_id, product_id),
                        INDEX idx_cart_user_id (user_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS orders (
                        id VARCHAR(32) PRIMARY KEY,
                        user_id BIGINT NOT NULL,
                        status VARCHAR(40) NOT NULL,
                        created_at DATETIME NOT NULL,
                        payment_method VARCHAR(40) NOT NULL,
                        payment_details_json JSON NOT NULL,
                        address_id BIGINT NULL,
                        shipping_address_json JSON NOT NULL,
                        notes TEXT NULL,
                        currency VARCHAR(8) NOT NULL,
                        total_amount DECIMAL(10,2) NOT NULL,
                        expected_delivery_at DATETIME NOT NULL,
                        INDEX idx_orders_user_id (user_id),
                        INDEX idx_orders_created_at (created_at)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS order_items (
                        id BIGINT AUTO_INCREMENT PRIMARY KEY,
                        order_id VARCHAR(32) NOT NULL,
                        product_id BIGINT NOT NULL,
                        product_name VARCHAR(255) NOT NULL,
                        unit_price DECIMAL(10,2) NOT NULL,
                        quantity INT NOT NULL,
                        line_total DECIMAL(10,2) NOT NULL,
                        INDEX idx_order_items_order_id (order_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS order_tracking_events (
                        id BIGINT AUTO_INCREMENT PRIMARY KEY,
                        order_id VARCHAR(32) NOT NULL,
                        stage VARCHAR(50) NOT NULL,
                        status VARCHAR(20) NOT NULL,
                        timestamp DATETIME NULL,
                        INDEX idx_order_events_order_id (order_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS style_quiz_profiles (
                        user_id BIGINT PRIMARY KEY,
                        preferred_categories_json JSON NOT NULL,
                        preferred_colors_json JSON NOT NULL,
                        preferred_materials_json JSON NOT NULL,
                        budget_max INT NULL,
                        occasions_json JSON NOT NULL,
                        updated_at BIGINT NOT NULL
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS recommendation_events (
                        id BIGINT AUTO_INCREMENT PRIMARY KEY,
                        user_id BIGINT NOT NULL,
                        event_type VARCHAR(16) NOT NULL,
                        product_id BIGINT NULL,
                        query_text VARCHAR(255) NULL,
                        created_at BIGINT NOT NULL,
                        INDEX idx_rec_events_user_id (user_id),
                        INDEX idx_rec_events_type (event_type)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS product_reviews (
                        id BIGINT AUTO_INCREMENT PRIMARY KEY,
                        product_id BIGINT NOT NULL,
                        user_id BIGINT NOT NULL,
                        rating DECIMAL(3,2) NOT NULL,
                        title VARCHAR(150) NOT NULL,
                        comment TEXT NOT NULL,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_reviews_product_id (product_id),
                        INDEX idx_reviews_user_id (user_id)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                    """
                )
            )
        app_engine.dispose()
    except Exception as exc:
        _init_error = str(exc)
        return

    _engine = None
    _session_maker = None
    _init_error = None
    _ensure_engine()
    seed_products_from_json_if_empty()
    seed_bottomwear_from_json_if_empty()
    seed_dupatta_from_assets_if_empty()
    seed_users_from_json_if_empty()
    seed_blog_from_json_if_empty()
    seed_faqs_from_json_if_empty()
    seed_addresses_from_json_if_empty()
    seed_cart_from_json_if_empty()
    seed_orders_from_json_if_empty()
    seed_style_quiz_from_json_if_empty()
    seed_recommendation_events_from_json_if_empty()
    seed_contact_messages_from_json_if_empty()


def _product_row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    sizes_raw = row.get("sizes_json", row.get("sizes"))
    sizes: list[str] = []
    if isinstance(sizes_raw, list):
        sizes = [str(size) for size in sizes_raw]
    elif isinstance(sizes_raw, str):
        try:
            parsed = json.loads(sizes_raw)
            if isinstance(parsed, list):
                sizes = [str(size) for size in parsed]
        except Exception:
            sizes = []

    return {
        "id": int(row.get("id", 0) or 0),
        "name": str(row.get("name", "")),
        "price": float(row.get("price", 0) or 0),
        "original_price": float(row.get("original_price", 0) or 0),
        "image_url": str(row.get("image_url") or row.get("image") or ""),
        "category": str(row.get("category", "")),
        "color": str(row.get("color", "")),
        "material": str(row.get("material", "")),
        "sizes": sizes,
        "rating": float(row.get("rating", 0) or 0),
        "reviews": int(row.get("reviews", 0) or 0),
        "description": str(row.get("description", "")),
        "product_type": str(row.get("product_type", "")) if row.get("product_type") is not None else "kurti",
    }


def _contact_row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    created_at = row.get("created_at")
    if isinstance(created_at, datetime):
        created_at_iso = created_at.replace(tzinfo=timezone.utc).isoformat()
    else:
        created_at_iso = str(created_at or "")

    return {
        "id": int(row.get("id", 0) or 0),
        "created_at": created_at_iso,
        "user_id": int(row["user_id"]) if row.get("user_id") is not None else None,
        "session_id": str(row.get("session_id")) if row.get("session_id") is not None else None,
        "name": str(row.get("name", "")),
        "email": str(row.get("email", "")),
        "phone": str(row.get("phone", "")) if row.get("phone") else None,
        "subject": str(row.get("subject", "")),
        "message": str(row.get("message", "")),
    }


def _order_row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    created_at = row.get("created_at")
    if isinstance(created_at, datetime):
        created_at_iso = created_at.replace(tzinfo=timezone.utc).isoformat()
    else:
        created_at_iso = str(created_at or "")

    expected_delivery_at = row.get("expected_delivery_at")
    if isinstance(expected_delivery_at, datetime):
        expected_delivery_iso = expected_delivery_at.replace(tzinfo=timezone.utc).isoformat()
    else:
        expected_delivery_iso = str(expected_delivery_at or "")

    payment_details_raw = row.get("payment_details_json")
    if isinstance(payment_details_raw, str):
        try:
            payment_details = json.loads(payment_details_raw)
        except Exception:
            payment_details = {}
    elif isinstance(payment_details_raw, dict):
        payment_details = payment_details_raw
    else:
        payment_details = {}

    shipping_raw = row.get("shipping_address_json")
    if isinstance(shipping_raw, str):
        try:
            shipping_address = json.loads(shipping_raw)
        except Exception:
            shipping_address = {}
    elif isinstance(shipping_raw, dict):
        shipping_address = shipping_raw
    else:
        shipping_address = {}

    return {
        "id": str(row.get("id", "")),
        "status": str(row.get("status", "")),
        "created_at": created_at_iso,
        "payment_method": str(row.get("payment_method", "")),
        "payment_details": payment_details,
        "address_id": int(row["address_id"]) if row.get("address_id") is not None else None,
        "shipping_address": shipping_address,
        "notes": row.get("notes"),
        "currency": str(row.get("currency", "")),
        "total_amount": float(row.get("total_amount", 0) or 0),
        "expected_delivery_at": expected_delivery_iso,
    }


def _order_item_row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "product_id": int(row.get("product_id", 0) or 0),
        "product_name": str(row.get("product_name", "")),
        "unit_price": float(row.get("unit_price", 0) or 0),
        "quantity": int(row.get("quantity", 0) or 0),
        "line_total": float(row.get("line_total", 0) or 0),
    }


def _order_event_row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    timestamp = row.get("timestamp")
    if isinstance(timestamp, datetime):
        timestamp_iso = timestamp.replace(tzinfo=timezone.utc).isoformat()
    else:
        timestamp_iso = None if timestamp is None else str(timestamp)

    return {
        "stage": str(row.get("stage", "")),
        "status": str(row.get("status", "")),
        "timestamp": timestamp_iso,
    }


def list_products_mysql() -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT id, name, price, original_price,
                           image_url,
                           category, color, material,
                           COALESCE(sizes_json, sizes) AS sizes_json,
                           rating, reviews, description, product_type
                    FROM products
                    WHERE COALESCE(product_type, 'kurti') = 'kurti'
                    ORDER BY id ASC
                    """
                )
            )
            .mappings()
            .all()
        )

    return [_product_row_to_dict(dict(row)) for row in rows]


def list_all_products_mysql() -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT id, name, price, original_price,
                           image_url,
                           category, color, material,
                           COALESCE(sizes_json, sizes) AS sizes_json,
                           rating, reviews, description, product_type
                    FROM products
                    ORDER BY id ASC
                    """
                )
            )
            .mappings()
            .all()
        )

    return [_product_row_to_dict(dict(row)) for row in rows]


def list_blog_mysql() -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT id, title, excerpt, category, date
                    FROM blog_posts
                    ORDER BY date DESC, id DESC
                    """
                )
            )
            .mappings()
            .all()
        )
    output: list[dict[str, Any]] = []
    for row in rows:
        date_value = row.get("date")
        if isinstance(date_value, datetime):
            date_str = date_value.date().isoformat()
        else:
            date_str = str(date_value)
        output.append(
            {
                "id": int(row.get("id", 0) or 0),
                "title": str(row.get("title", "")),
                "excerpt": str(row.get("excerpt", "")),
                "category": str(row.get("category", "")),
                "date": date_str,
            }
        )
    return output


def list_faqs_mysql() -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT id, question, answer
                    FROM faqs
                    ORDER BY id ASC
                    """
                )
            )
            .mappings()
            .all()
        )
    return [
        {
            "id": int(row.get("id", 0) or 0),
            "question": str(row.get("question", "")),
            "answer": str(row.get("answer", "")),
        }
        for row in rows
    ]


def list_bottomwear_mysql() -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT id, name, price, original_price,
                           image_url,
                           category, color, material,
                           COALESCE(sizes_json, sizes) AS sizes_json,
                           rating, reviews, description, product_type
                    FROM products
                    WHERE COALESCE(product_type, 'kurti') = 'bottomwear'
                    ORDER BY id ASC
                    """
                )
            )
            .mappings()
            .all()
        )

    return [_product_row_to_dict(dict(row)) for row in rows]


def list_dupatta_mysql() -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT id, name, price, original_price,
                           image_url,
                           category, color, material,
                           COALESCE(sizes_json, sizes) AS sizes_json,
                           rating, reviews, description, product_type
                    FROM products
                    WHERE COALESCE(product_type, 'kurti') = 'dupatta'
                    ORDER BY id ASC
                    """
                )
            )
            .mappings()
            .all()
        )

    return [_product_row_to_dict(dict(row)) for row in rows]


def get_bottomwear_mysql(product_id: int) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        row = (
            session.execute(
                text(
                    """
                    SELECT id, name, price, original_price, image_url, category, color, material, sizes_json, rating, reviews, description, product_type
                    FROM products
                    WHERE id = :product_id AND COALESCE(product_type, 'kurti') = 'bottomwear'
                    LIMIT 1
                    """
                ),
                {"product_id": product_id},
            )
            .mappings()
            .first()
        )

    return _product_row_to_dict(dict(row)) if row else None


def get_product_mysql(product_id: int) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        row = (
            session.execute(
                text(
                    """
                    SELECT id, name, price, original_price,
                           image_url,
                           category, color, material,
                           COALESCE(sizes_json, sizes) AS sizes_json,
                           rating, reviews, description, product_type
                    FROM products
                    WHERE id = :product_id
                    LIMIT 1
                    """
                ),
                {"product_id": product_id},
            )
            .mappings()
            .first()
        )

    return _product_row_to_dict(dict(row)) if row else None


def list_addresses_mysql(user_id: int) -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT user_id, id, full_name, phone, line1, line2, city, state, postal_code, country
                    FROM addresses
                    WHERE user_id = :user_id
                    ORDER BY id ASC
                    """
                ),
                {"user_id": user_id},
            )
            .mappings()
            .all()
        )
    return [dict(row) for row in rows]


def create_address_mysql(user_id: int, payload: dict[str, Any]) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        row = session.execute(
            text(
                """
                SELECT COALESCE(MAX(id), 0) AS max_id
                FROM addresses
                WHERE user_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).mappings().first()
        next_id = int((row or {}).get("max_id", 0) or 0) + 1

        session.execute(
            text(
                """
                INSERT INTO addresses (
                    user_id, id, full_name, phone, line1, line2, city, state, postal_code, country, created_at
                ) VALUES (
                    :user_id, :id, :full_name, :phone, :line1, :line2, :city, :state, :postal_code, :country, :created_at
                )
                """
            ),
            {
                "user_id": user_id,
                "id": next_id,
                "full_name": str(payload.get("full_name", "")),
                "phone": str(payload.get("phone", "")),
                "line1": str(payload.get("line1", "")),
                "line2": str(payload.get("line2", "")) if payload.get("line2") else None,
                "city": str(payload.get("city", "")),
                "state": str(payload.get("state", "")),
                "postal_code": str(payload.get("postal_code", "")),
                "country": str(payload.get("country", "")),
                "created_at": int(time.time()),
            },
        )
        session.commit()

    return {
        "id": next_id,
        "full_name": str(payload.get("full_name", "")),
        "phone": str(payload.get("phone", "")),
        "line1": str(payload.get("line1", "")),
        "line2": str(payload.get("line2", "")) if payload.get("line2") else None,
        "city": str(payload.get("city", "")),
        "state": str(payload.get("state", "")),
        "postal_code": str(payload.get("postal_code", "")),
        "country": str(payload.get("country", "")),
    }


def update_address_mysql(user_id: int, address_id: int, payload: dict[str, Any]) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        result = session.execute(
            text(
                """
                UPDATE addresses
                SET
                    full_name = :full_name,
                    phone = :phone,
                    line1 = :line1,
                    line2 = :line2,
                    city = :city,
                    state = :state,
                    postal_code = :postal_code,
                    country = :country
                WHERE user_id = :user_id AND id = :id
                """
            ),
            {
                "user_id": user_id,
                "id": address_id,
                "full_name": str(payload.get("full_name", "")),
                "phone": str(payload.get("phone", "")),
                "line1": str(payload.get("line1", "")),
                "line2": str(payload.get("line2", "")) if payload.get("line2") else None,
                "city": str(payload.get("city", "")),
                "state": str(payload.get("state", "")),
                "postal_code": str(payload.get("postal_code", "")),
                "country": str(payload.get("country", "")),
            },
        )
        session.commit()
        if int(result.rowcount or 0) <= 0:
            return None

    return {
        "id": address_id,
        "full_name": str(payload.get("full_name", "")),
        "phone": str(payload.get("phone", "")),
        "line1": str(payload.get("line1", "")),
        "line2": str(payload.get("line2", "")) if payload.get("line2") else None,
        "city": str(payload.get("city", "")),
        "state": str(payload.get("state", "")),
        "postal_code": str(payload.get("postal_code", "")),
        "country": str(payload.get("country", "")),
    }


def delete_address_mysql(user_id: int, address_id: int) -> bool:
    setup = _ensure_engine()
    if setup is None:
        return False
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        result = session.execute(
            text("DELETE FROM addresses WHERE user_id = :user_id AND id = :id"),
            {"user_id": user_id, "id": address_id},
        )
        session.commit()
        return int(result.rowcount or 0) > 0


def list_cart_items_mysql(user_id: int) -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT product_id, quantity
                    FROM cart_items
                    WHERE user_id = :user_id
                    ORDER BY product_id ASC
                    """
                ),
                {"user_id": user_id},
            )
            .mappings()
            .all()
        )
    return [
        {"product_id": int(row.get("product_id", 0) or 0), "quantity": int(row.get("quantity", 0) or 0)}
        for row in rows
    ]


def upsert_cart_item_mysql(user_id: int, product_id: int, quantity: int) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        session.execute(
            text(
                """
                INSERT INTO cart_items (user_id, product_id, quantity, updated_at)
                VALUES (:user_id, :product_id, :quantity, :updated_at)
                ON DUPLICATE KEY UPDATE
                    quantity = :quantity,
                    updated_at = :updated_at
                """
            ),
            {
                "user_id": user_id,
                "product_id": product_id,
                "quantity": quantity,
                "updated_at": int(time.time()),
            },
        )
        session.commit()
    return {"product_id": product_id, "quantity": quantity}


def update_cart_item_mysql(user_id: int, product_id: int, quantity: int) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        result = session.execute(
            text(
                """
                UPDATE cart_items
                SET quantity = :quantity, updated_at = :updated_at
                WHERE user_id = :user_id AND product_id = :product_id
                """
            ),
            {
                "user_id": user_id,
                "product_id": product_id,
                "quantity": quantity,
                "updated_at": int(time.time()),
            },
        )
        session.commit()
        if int(result.rowcount or 0) <= 0:
            return None
    return {"product_id": product_id, "quantity": quantity}


def delete_cart_item_mysql(user_id: int, product_id: int) -> bool:
    setup = _ensure_engine()
    if setup is None:
        return False
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        result = session.execute(
            text("DELETE FROM cart_items WHERE user_id = :user_id AND product_id = :product_id"),
            {"user_id": user_id, "product_id": product_id},
        )
        session.commit()
        return int(result.rowcount or 0) > 0


def clear_cart_mysql(user_id: int) -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        session.execute(
            text("DELETE FROM cart_items WHERE user_id = :user_id"),
            {"user_id": user_id},
        )
        session.commit()


def list_all_cart_mysql() -> dict[str, list[dict[str, Any]]]:
    setup = _ensure_engine()
    if setup is None:
        return {}
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT user_id, product_id, quantity
                    FROM cart_items
                    ORDER BY user_id ASC, product_id ASC
                    """
                )
            )
            .mappings()
            .all()
        )
    store: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        key = str(int(row.get("user_id", 0) or 0))
        store.setdefault(key, []).append(
            {
                "product_id": int(row.get("product_id", 0) or 0),
                "quantity": int(row.get("quantity", 0) or 0),
            }
        )
    return store


def list_orders_mysql(user_id: int) -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        order_rows = (
            session.execute(
                text(
                    """
                    SELECT id, status, created_at, payment_method, payment_details_json, address_id,
                           shipping_address_json, notes, currency, total_amount, expected_delivery_at
                    FROM orders
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC, id DESC
                    """
                ),
                {"user_id": user_id},
            )
            .mappings()
            .all()
        )

        orders: list[dict[str, Any]] = []
        for row in order_rows:
            order_id = str(row.get("id", ""))
            items = (
                session.execute(
                    text(
                        """
                        SELECT product_id, product_name, unit_price, quantity, line_total
                        FROM order_items
                        WHERE order_id = :order_id
                        ORDER BY id ASC
                        """
                    ),
                    {"order_id": order_id},
                )
                .mappings()
                .all()
            )
            events = (
                session.execute(
                    text(
                        """
                        SELECT stage, status, timestamp
                        FROM order_tracking_events
                        WHERE order_id = :order_id
                        ORDER BY id ASC
                        """
                    ),
                    {"order_id": order_id},
                )
                .mappings()
                .all()
            )

            payload = _order_row_to_dict(dict(row))
            payload["items"] = [_order_item_row_to_dict(dict(item)) for item in items]
            payload["tracking_events"] = [_order_event_row_to_dict(dict(event)) for event in events]
            orders.append(payload)

    return orders


def get_order_mysql(user_id: int, order_id: str) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        row = (
            session.execute(
                text(
                    """
                    SELECT id, status, created_at, payment_method, payment_details_json, address_id,
                           shipping_address_json, notes, currency, total_amount, expected_delivery_at
                    FROM orders
                    WHERE id = :order_id AND user_id = :user_id
                    LIMIT 1
                    """
                ),
                {"order_id": order_id, "user_id": user_id},
            )
            .mappings()
            .first()
        )
        if not row:
            return None

        items = (
            session.execute(
                text(
                    """
                    SELECT product_id, product_name, unit_price, quantity, line_total
                    FROM order_items
                    WHERE order_id = :order_id
                    ORDER BY id ASC
                    """
                ),
                {"order_id": order_id},
            )
            .mappings()
            .all()
        )
        events = (
            session.execute(
                text(
                    """
                    SELECT stage, status, timestamp
                    FROM order_tracking_events
                    WHERE order_id = :order_id
                    ORDER BY id ASC
                    """
                ),
                {"order_id": order_id},
            )
            .mappings()
            .all()
        )

    payload = _order_row_to_dict(dict(row))
    payload["items"] = [_order_item_row_to_dict(dict(item)) for item in items]
    payload["tracking_events"] = [_order_event_row_to_dict(dict(event)) for event in events]
    return payload


def list_orders_admin_mysql() -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        order_rows = (
            session.execute(
                text(
                    """
                    SELECT id, user_id, status, created_at, payment_method, payment_details_json, address_id,
                           shipping_address_json, notes, currency, total_amount, expected_delivery_at
                    FROM orders
                    ORDER BY created_at DESC, id DESC
                    """
                )
            )
            .mappings()
            .all()
        )

        orders: list[dict[str, Any]] = []
        for row in order_rows:
            order_id = str(row.get("id", ""))
            items = (
                session.execute(
                    text(
                        """
                        SELECT product_id, product_name, unit_price, quantity, line_total
                        FROM order_items
                        WHERE order_id = :order_id
                        ORDER BY id ASC
                        """
                    ),
                    {"order_id": order_id},
                )
                .mappings()
                .all()
            )
            events = (
                session.execute(
                    text(
                        """
                        SELECT stage, status, timestamp
                        FROM order_tracking_events
                        WHERE order_id = :order_id
                        ORDER BY id ASC
                        """
                    ),
                    {"order_id": order_id},
                )
                .mappings()
                .all()
            )

            payload = _order_row_to_dict(dict(row))
            payload["user_id"] = int(row.get("user_id", 0) or 0)
            payload["items"] = [_order_item_row_to_dict(dict(item)) for item in items]
            payload["tracking_events"] = [_order_event_row_to_dict(dict(event)) for event in events]
            orders.append(payload)
    return orders


def create_order_mysql(order: dict[str, Any]) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    created_at_raw = order.get("created_at")
    try:
        created_at = datetime.fromisoformat(str(created_at_raw))
    except Exception:
        created_at = datetime.now(timezone.utc)

    expected_raw = order.get("expected_delivery_at")
    try:
        expected_delivery_at = datetime.fromisoformat(str(expected_raw))
    except Exception:
        expected_delivery_at = created_at

    with session_maker() as session:
        session.execute(
            text(
                """
                INSERT INTO orders (
                    id, user_id, status, created_at, payment_method, payment_details_json, address_id,
                    shipping_address_json, notes, currency, total_amount, expected_delivery_at
                ) VALUES (
                    :id, :user_id, :status, :created_at, :payment_method, :payment_details_json, :address_id,
                    :shipping_address_json, :notes, :currency, :total_amount, :expected_delivery_at
                )
                """
            ),
            {
                "id": str(order.get("id", "")),
                "user_id": int(order.get("user_id", 0) or 0),
                "status": str(order.get("status", "")),
                "created_at": created_at,
                "payment_method": str(order.get("payment_method", "")),
                "payment_details_json": json.dumps(order.get("payment_details", {}) or {}, ensure_ascii=True),
                "address_id": order.get("address_id"),
                "shipping_address_json": json.dumps(order.get("shipping_address", {}) or {}, ensure_ascii=True),
                "notes": order.get("notes"),
                "currency": str(order.get("currency", "")),
                "total_amount": float(order.get("total_amount", 0) or 0),
                "expected_delivery_at": expected_delivery_at,
            },
        )

        for item in order.get("items", []) or []:
            if not isinstance(item, dict):
                continue
            session.execute(
                text(
                    """
                    INSERT INTO order_items (
                        order_id, product_id, product_name, unit_price, quantity, line_total
                    ) VALUES (
                        :order_id, :product_id, :product_name, :unit_price, :quantity, :line_total
                    )
                    """
                ),
                {
                    "order_id": str(order.get("id", "")),
                    "product_id": int(item.get("product_id", 0) or 0),
                    "product_name": str(item.get("product_name", "")),
                    "unit_price": float(item.get("unit_price", 0) or 0),
                    "quantity": int(item.get("quantity", 0) or 0),
                    "line_total": float(item.get("line_total", 0) or 0),
                },
            )

        for event in order.get("tracking_events", []) or []:
            if not isinstance(event, dict):
                continue
            ts_raw = event.get("timestamp")
            if ts_raw:
                try:
                    ts_parsed = datetime.fromisoformat(str(ts_raw))
                except Exception:
                    ts_parsed = None
            else:
                ts_parsed = None

            session.execute(
                text(
                    """
                    INSERT INTO order_tracking_events (order_id, stage, status, timestamp)
                    VALUES (:order_id, :stage, :status, :timestamp)
                    """
                ),
                {
                    "order_id": str(order.get("id", "")),
                    "stage": str(event.get("stage", "")),
                    "status": str(event.get("status", "")),
                    "timestamp": ts_parsed,
                },
            )

        session.commit()

    return get_order_mysql(int(order.get("user_id", 0) or 0), str(order.get("id", "")))


def list_all_orders_mysql() -> dict[str, list[dict[str, Any]]]:
    setup = _ensure_engine()
    if setup is None:
        return {}
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT id, user_id, status, created_at, payment_method, payment_details_json, address_id,
                           shipping_address_json, notes, currency, total_amount, expected_delivery_at
                    FROM orders
                    ORDER BY created_at DESC, id DESC
                    """
                )
            )
            .mappings()
            .all()
        )

        store: dict[str, list[dict[str, Any]]] = {}
        for row in rows:
            order_id = str(row.get("id", ""))
            items = (
                session.execute(
                    text(
                        """
                        SELECT product_id, product_name, unit_price, quantity, line_total
                        FROM order_items
                        WHERE order_id = :order_id
                        ORDER BY id ASC
                        """
                    ),
                    {"order_id": order_id},
                )
                .mappings()
                .all()
            )
            events = (
                session.execute(
                    text(
                        """
                        SELECT stage, status, timestamp
                        FROM order_tracking_events
                        WHERE order_id = :order_id
                        ORDER BY id ASC
                        """
                    ),
                    {"order_id": order_id},
                )
                .mappings()
                .all()
            )
            payload = _order_row_to_dict(dict(row))
            payload["items"] = [_order_item_row_to_dict(dict(item)) for item in items]
            payload["tracking_events"] = [_order_event_row_to_dict(dict(event)) for event in events]
            key = str(int(row.get("user_id", 0) or 0))
            store.setdefault(key, []).append(payload)

    return store


def list_product_reviews_mysql(product_id: int) -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT r.id, r.product_id, r.user_id, r.rating, r.title, r.comment, r.created_at,
                           u.name AS author_name
                    FROM product_reviews r
                    LEFT JOIN users u ON u.id = r.user_id
                    WHERE r.product_id = :product_id
                    ORDER BY r.created_at DESC, r.id DESC
                    """
                ),
                {"product_id": product_id},
            )
            .mappings()
            .all()
        )
    output: list[dict[str, Any]] = []
    for row in rows:
        created_at = row.get("created_at")
        if isinstance(created_at, datetime):
            created_at_iso = created_at.replace(tzinfo=timezone.utc).isoformat()
        else:
            created_at_iso = str(created_at or "")
        output.append(
            {
                "id": int(row.get("id", 0) or 0),
                "product_id": int(row.get("product_id", 0) or 0),
                "user_id": int(row.get("user_id", 0) or 0),
                "author": str(row.get("author_name") or "Customer"),
                "rating": float(row.get("rating", 0) or 0),
                "title": str(row.get("title", "")),
                "comment": str(row.get("comment", "")),
                "date": created_at_iso,
            }
        )
    return output


def create_product_review_mysql(
    *,
    product_id: int,
    user_id: int,
    rating: float,
    title: str,
    comment: str,
) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        result = session.execute(
            text(
                """
                INSERT INTO product_reviews (product_id, user_id, rating, title, comment)
                VALUES (:product_id, :user_id, :rating, :title, :comment)
                """
            ),
            {
                "product_id": product_id,
                "user_id": user_id,
                "rating": float(rating),
                "title": str(title),
                "comment": str(comment),
            },
        )
        session.commit()
        review_id = int(result.lastrowid or 0)
        if review_id <= 0:
            return None

        row = session.execute(
            text(
                """
                SELECT r.id, r.product_id, r.user_id, r.rating, r.title, r.comment, r.created_at,
                       u.name AS author_name
                FROM product_reviews r
                LEFT JOIN users u ON u.id = r.user_id
                WHERE r.id = :id
                LIMIT 1
                """
            ),
            {"id": review_id},
        ).mappings().first()

    if not row:
        return None

    created_at = row.get("created_at")
    if isinstance(created_at, datetime):
        created_at_iso = created_at.replace(tzinfo=timezone.utc).isoformat()
    else:
        created_at_iso = str(created_at or "")
    return {
        "id": int(row.get("id", 0) or 0),
        "product_id": int(row.get("product_id", 0) or 0),
        "user_id": int(row.get("user_id", 0) or 0),
        "author": str(row.get("author_name") or "Customer"),
        "rating": float(row.get("rating", 0) or 0),
        "title": str(row.get("title", "")),
        "comment": str(row.get("comment", "")),
        "date": created_at_iso,
    }


def user_has_purchased_product_mysql(user_id: int, product_id: int) -> bool:
    setup = _ensure_engine()
    if setup is None:
        return False
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        row = session.execute(
            text(
                """
                SELECT 1
                FROM orders o
                JOIN order_items i ON i.order_id = o.id
                WHERE o.user_id = :user_id AND i.product_id = :product_id
                LIMIT 1
                """
            ),
            {"user_id": user_id, "product_id": product_id},
        ).first()
    return row is not None


def create_contact_message_mysql(
    *,
    user_id: int | None,
    session_id: str | None,
    name: str,
    email: str,
    phone: str | None,
    subject: str,
    message: str,
) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        result = session.execute(
            text(
                """
                INSERT INTO contact_messages (user_id, session_id, name, email, phone, subject, message)
                VALUES (:user_id, :session_id, :name, :email, :phone, :subject, :message)
                """
            ),
            {
                "user_id": user_id,
                "session_id": session_id,
                "name": name,
                "email": email,
                "phone": phone,
                "subject": subject,
                "message": message,
            },
        )
        session.commit()
        inserted_id = int(result.lastrowid or 0)
        if inserted_id <= 0:
            return None

        row = session.execute(
            text(
                """
                SELECT id, created_at, user_id, session_id, name, email, phone, subject, message
                FROM contact_messages
                WHERE id = :id
                LIMIT 1
                """
            ),
            {"id": inserted_id},
        ).mappings().first()

    return _contact_row_to_dict(dict(row)) if row else None


def list_contact_messages_for_user_mysql(user_id: int) -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT id, created_at, user_id, session_id, name, email, phone, subject, message
                    FROM contact_messages
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC, id DESC
                    """
                ),
                {"user_id": user_id},
            )
            .mappings()
            .all()
        )

    return [_contact_row_to_dict(dict(row)) for row in rows]


def list_contact_messages_admin_mysql(limit: int = 500) -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    safe_limit = max(1, min(int(limit), 2000))

    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT id, created_at, user_id, session_id, name, email, phone, subject, message
                    FROM contact_messages
                    ORDER BY created_at DESC, id DESC
                    LIMIT :limit
                    """
                ),
                {"limit": safe_limit},
            )
            .mappings()
            .all()
        )

    return [_contact_row_to_dict(dict(row)) for row in rows]


def create_product_mysql(payload: dict[str, Any]) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    sizes = payload.get("sizes", [])
    if not isinstance(sizes, list):
        sizes = []

    with session_maker() as session:
        session.execute(
            text(
                """
                INSERT INTO products (
                    id, name, price, original_price, image_url, category, color, material, sizes_json, rating, reviews, description, created_at, product_type
                ) VALUES (
                    :id, :name, :price, :original_price, :image_url, :category, :color, :material, :sizes_json, :rating, :reviews, :description, :created_at, :product_type
                )
                """
            ),
            {
                "id": int(payload.get("id", 0) or 0),
                "name": str(payload.get("name", "")),
                "price": float(payload.get("price", 0) or 0),
                "original_price": float(payload.get("original_price", 0) or 0),
                "image_url": str(payload.get("image_url", "")),
                "category": str(payload.get("category", "")),
                "color": str(payload.get("color", "")),
                "material": str(payload.get("material", "")),
                "sizes_json": json.dumps([str(size) for size in sizes], ensure_ascii=True),
                "rating": float(payload.get("rating", 0) or 0),
                "reviews": int(payload.get("reviews", 0) or 0),
                "description": str(payload.get("description", "")),
                "created_at": int(payload.get("created_at", int(time.time()))),
                "product_type": str(payload.get("product_type") or payload.get("category_type") or "kurti"),
            },
        )
        session.commit()

    return get_product_mysql(int(payload.get("id", 0) or 0))


def update_product_mysql(product_id: int, payload: dict[str, Any]) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    sizes = payload.get("sizes", [])
    if not isinstance(sizes, list):
        sizes = []

    with session_maker() as session:
        result = session.execute(
            text(
                """
                UPDATE products
                SET
                    name = :name,
                    price = :price,
                    original_price = :original_price,
                    image_url = :image_url,
                    category = :category,
                    color = :color,
                    material = :material,
                    sizes_json = :sizes_json,
                    rating = :rating,
                    reviews = :reviews,
                    description = :description,
                    product_type = :product_type
                WHERE id = :id
                """
            ),
            {
                "id": product_id,
                "name": str(payload.get("name", "")),
                "price": float(payload.get("price", 0) or 0),
                "original_price": float(payload.get("original_price", 0) or 0),
                "image_url": str(payload.get("image_url", "")),
                "category": str(payload.get("category", "")),
                "color": str(payload.get("color", "")),
                "material": str(payload.get("material", "")),
                "sizes_json": json.dumps([str(size) for size in sizes], ensure_ascii=True),
                "rating": float(payload.get("rating", 0) or 0),
                "reviews": int(payload.get("reviews", 0) or 0),
                "description": str(payload.get("description", "")),
                "product_type": str(payload.get("product_type") or payload.get("category_type") or "kurti"),
            },
        )
        session.commit()
        if int(result.rowcount or 0) <= 0:
            return None

    return get_product_mysql(product_id)


def delete_product_mysql(product_id: int) -> bool:
    setup = _ensure_engine()
    if setup is None:
        return False
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        result = session.execute(
            text("DELETE FROM products WHERE id = :id"),
            {"id": product_id},
        )
        session.commit()
        return int(result.rowcount or 0) > 0


def seed_products_from_json_if_empty() -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        count = session.execute(text("SELECT COUNT(*) AS c FROM products")).mappings().first()
        if int((count or {}).get("c", 0) or 0) > 0:
            return

    try:
        try:
            from .database import read_json
        except ImportError:
            from database import read_json

        source_products = read_json("products.json", default=[])
    except Exception:
        source_products = []

    if not isinstance(source_products, list) or not source_products:
        return

    now_ts = int(time.time())
    with session_maker() as session:
        for product in source_products:
            if not isinstance(product, dict):
                continue
            product_id = int(product.get("id", 0) or 0)
            if product_id <= 0:
                continue

            sizes = product.get("sizes", [])
            if not isinstance(sizes, list):
                sizes = []

            session.execute(
                text(
                    """
                    INSERT INTO products (
                        id, name, price, original_price, image_url, category, color, material, sizes_json, rating, reviews, description, created_at, product_type
                    ) VALUES (
                        :id, :name, :price, :original_price, :image_url, :category, :color, :material, :sizes_json, :rating, :reviews, :description, :created_at, :product_type
                    )
                    """
                ),
                {
                    "id": product_id,
                    "name": str(product.get("name", "")),
                    "price": float(product.get("price", 0) or 0),
                    "original_price": float(product.get("original_price", 0) or 0),
                    "image_url": str(product.get("image_url", "")),
                    "category": str(product.get("category", "")),
                    "color": str(product.get("color", "")),
                    "material": str(product.get("material", "")),
                    "sizes_json": json.dumps([str(size) for size in sizes], ensure_ascii=True),
                    "rating": float(product.get("rating", 0) or 0),
                    "reviews": int(product.get("reviews", 0) or 0),
                    "description": str(product.get("description", "")),
                    "created_at": now_ts,
                    "product_type": "kurti",
                },
            )
        session.commit()


def seed_bottomwear_from_json_if_empty() -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        count = (
            session.execute(
                text(
                    """
                    SELECT COUNT(*) AS c
                    FROM products
                    WHERE COALESCE(product_type, 'kurti') = 'bottomwear'
                    """
                )
            )
            .mappings()
            .first()
        )
        if int((count or {}).get("c", 0) or 0) > 0:
            return

    try:
        try:
            from .database import read_json
        except ImportError:
            from database import read_json

        source_products = read_json("bottomwear_products.json", default=[])
    except Exception:
        source_products = []

    now_ts = int(time.time())
    with session_maker() as session:
        if isinstance(source_products, list) and source_products:
            for product in source_products:
                if not isinstance(product, dict):
                    continue
                product_id = int(product.get("id", 0) or 0)
                if product_id <= 0:
                    continue

                sizes = product.get("sizes", [])
                if not isinstance(sizes, list):
                    sizes = []

                session.execute(
                    text(
                        """
                        INSERT IGNORE INTO products (
                            id, name, price, original_price, image_url, category, color, material, sizes_json, rating, reviews, description, created_at, product_type
                        ) VALUES (
                            :id, :name, :price, :original_price, :image_url, :category, :color, :material, :sizes_json, :rating, :reviews, :description, :created_at, :product_type
                        )
                        """
                    ),
                    {
                        "id": product_id,
                        "name": str(product.get("name", "")),
                        "price": float(product.get("price", 0) or 0),
                        "original_price": float(product.get("original_price", 0) or 0),
                        "image_url": str(product.get("image_url", "")),
                        "category": str(product.get("category", "")),
                        "color": str(product.get("color", "")),
                        "material": str(product.get("material", "")),
                        "sizes_json": json.dumps([str(size) for size in sizes], ensure_ascii=True),
                        "rating": float(product.get("rating", 0) or 0),
                        "reviews": int(product.get("reviews", 0) or 0),
                        "description": str(product.get("description", "")),
                        "created_at": now_ts,
                        "product_type": "bottomwear",
                    },
                )
        session.commit()


def seed_dupatta_from_assets_if_empty() -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        count = (
            session.execute(
                text(
                    """
                    SELECT COUNT(*) AS c
                    FROM products
                    WHERE COALESCE(product_type, 'kurti') = 'dupatta'
                    """
                )
            )
            .mappings()
            .first()
        )
        if int((count or {}).get("c", 0) or 0) > 0:
            return

    assets_root = Path(__file__).resolve().parents[3] / "chudi" / "src" / "assets" / "dupatta"
    if not assets_root.exists():
        return

    image_exts = {".png", ".jpg", ".jpeg", ".webp"}
    image_paths = [path for path in assets_root.rglob("*") if path.is_file() and path.suffix.lower() in image_exts]
    if not image_paths:
        return

    def _price_for_category(category: str) -> int:
        # Random price between 199 and 599 for realistic variation.
        return random.randint(199, 599)

    def _material_for_category(category: str) -> str:
        lowered = category.lower()
        if "casual" in lowered or "regular" in lowered:
            return "Cotton"
        if "multi" in lowered:
            return "Chiffon"
        if "festive" in lowered:
            return "Silk Blend"
        return "Cotton"

    with session_maker() as session:
        max_row = session.execute(text("SELECT COALESCE(MAX(id), 0) AS max_id FROM products")).mappings().first()
        next_id = int((max_row or {}).get("max_id", 0) or 0) + 1

        now_ts = int(time.time())
        for image_path in sorted(image_paths):
            try:
                relative = image_path.relative_to(assets_root).as_posix()
            except ValueError:
                continue
            folder = relative.split("/", 1)[0] if "/" in relative else "Dupatta"
            category = folder.strip() or "Dupatta"
            name = image_path.stem.replace("_", " ").replace("-", " ").strip().title()
            if not name:
                name = f"{category} Dupatta"

            price = _price_for_category(category)
            material = _material_for_category(category)
            image_url = "/assets/dupatta/" + quote(relative, safe="/")

            session.execute(
                text(
                    """
                    INSERT IGNORE INTO products (
                        id, name, price, original_price, image_url, category, color, material, sizes_json, rating, reviews, description, created_at, product_type
                    ) VALUES (
                        :id, :name, :price, :original_price, :image_url, :category, :color, :material, :sizes_json, :rating, :reviews, :description, :created_at, :product_type
                    )
                    """
                ),
                {
                    "id": next_id,
                    "name": name,
                    "price": price,
                    "original_price": price + 200,
                    "image_url": image_url,
                    "category": category,
                    "color": "Assorted",
                    "material": material,
                    "sizes_json": json.dumps(["Free Size"], ensure_ascii=True),
                    "rating": 4.4,
                    "reviews": 36,
                    "description": f"{category} in soft {material} for easy styling.",
                    "created_at": now_ts,
                    "product_type": "dupatta",
                },
            )
            next_id += 1
        session.commit()


def seed_users_from_json_if_empty() -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        count = session.execute(text("SELECT COUNT(*) AS c FROM users")).mappings().first()
        if int((count or {}).get("c", 0) or 0) > 0:
            return

    try:
        try:
            from .database import read_json
        except ImportError:
            from database import read_json
        source_users = read_json("users.json", default=[])
    except Exception:
        source_users = []

    if not isinstance(source_users, list) or not source_users:
        return

    with session_maker() as session:
        for user in source_users:
            if not isinstance(user, dict):
                continue
            user_id = int(user.get("id", 0) or 0)
            if user_id <= 0:
                continue
            session.execute(
                text(
                    """
                    INSERT INTO users (id, name, email, salt, password_hash, is_admin, created_at)
                    VALUES (:id, :name, :email, :salt, :password_hash, :is_admin, :created_at)
                    """
                ),
                {
                    "id": user_id,
                    "name": str(user.get("name", "")),
                    "email": str(user.get("email", "")),
                    "salt": str(user.get("salt", "")),
                    "password_hash": str(user.get("password_hash", "")),
                    "is_admin": 1 if bool(user.get("is_admin", False)) else 0,
                    "created_at": int(user.get("created_at", int(time.time()))),
                },
            )
        session.commit()


def seed_blog_from_json_if_empty() -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        count = session.execute(text("SELECT COUNT(*) AS c FROM blog_posts")).mappings().first()
        if int((count or {}).get("c", 0) or 0) > 0:
            return

    try:
        try:
            from .database import read_json, DEFAULT_BLOG
        except ImportError:
            from database import read_json, DEFAULT_BLOG
        source_blog = read_json("blog.json", default=DEFAULT_BLOG)
    except Exception:
        source_blog = []

    if not isinstance(source_blog, list) or not source_blog:
        return

    with session_maker() as session:
        for entry in source_blog:
            if not isinstance(entry, dict):
                continue
            post_id = int(entry.get("id", 0) or 0)
            if post_id <= 0:
                continue
            raw_date = str(entry.get("date", ""))
            try:
                date_obj = datetime.fromisoformat(raw_date).date()
            except Exception:
                date_obj = datetime.now(timezone.utc).date()
            session.execute(
                text(
                    """
                    INSERT INTO blog_posts (id, title, excerpt, category, date)
                    VALUES (:id, :title, :excerpt, :category, :date)
                    """
                ),
                {
                    "id": post_id,
                    "title": str(entry.get("title", "")),
                    "excerpt": str(entry.get("excerpt", "")),
                    "category": str(entry.get("category", "")),
                    "date": date_obj,
                },
            )
        session.commit()


def seed_faqs_from_json_if_empty() -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        count = session.execute(text("SELECT COUNT(*) AS c FROM faqs")).mappings().first()
        if int((count or {}).get("c", 0) or 0) > 0:
            return

    try:
        try:
            from .database import read_json, DEFAULT_FAQS
        except ImportError:
            from database import read_json, DEFAULT_FAQS
        source_faqs = read_json("faqs.json", default=DEFAULT_FAQS)
    except Exception:
        source_faqs = []

    if not isinstance(source_faqs, list) or not source_faqs:
        return

    with session_maker() as session:
        for entry in source_faqs:
            if not isinstance(entry, dict):
                continue
            faq_id = int(entry.get("id", 0) or 0)
            if faq_id <= 0:
                continue
            session.execute(
                text(
                    """
                    INSERT INTO faqs (id, question, answer)
                    VALUES (:id, :question, :answer)
                    """
                ),
                {
                    "id": faq_id,
                    "question": str(entry.get("question", "")),
                    "answer": str(entry.get("answer", "")),
                },
            )
        session.commit()


def seed_addresses_from_json_if_empty() -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        count = session.execute(text("SELECT COUNT(*) AS c FROM addresses")).mappings().first()
        if int((count or {}).get("c", 0) or 0) > 0:
            return

    try:
        try:
            from .database import read_json
        except ImportError:
            from database import read_json
        source_addresses = read_json("addresses.json", default={})
    except Exception:
        source_addresses = {}

    if not isinstance(source_addresses, dict) or not source_addresses:
        return

    now_ts = int(time.time())
    with session_maker() as session:
        for user_key, rows in source_addresses.items():
            try:
                user_id = int(user_key)
            except (TypeError, ValueError):
                continue
            if not isinstance(rows, list):
                continue
            for entry in rows:
                if not isinstance(entry, dict):
                    continue
                address_id = int(entry.get("id", 0) or 0)
                if address_id <= 0:
                    continue
                session.execute(
                    text(
                        """
                        INSERT INTO addresses (
                            user_id, id, full_name, phone, line1, line2, city, state, postal_code, country, created_at
                        ) VALUES (
                            :user_id, :id, :full_name, :phone, :line1, :line2, :city, :state, :postal_code, :country, :created_at
                        )
                        """
                    ),
                    {
                        "user_id": user_id,
                        "id": address_id,
                        "full_name": str(entry.get("full_name", "")),
                        "phone": str(entry.get("phone", "")),
                        "line1": str(entry.get("line1", "")),
                        "line2": str(entry.get("line2", "")) if entry.get("line2") else None,
                        "city": str(entry.get("city", "")),
                        "state": str(entry.get("state", "")),
                        "postal_code": str(entry.get("postal_code", "")),
                        "country": str(entry.get("country", "")),
                        "created_at": int(entry.get("created_at", now_ts) or now_ts),
                    },
                )
        session.commit()


def seed_cart_from_json_if_empty() -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        count = session.execute(text("SELECT COUNT(*) AS c FROM cart_items")).mappings().first()
        if int((count or {}).get("c", 0) or 0) > 0:
            return

    try:
        try:
            from .database import read_json
        except ImportError:
            from database import read_json
        source_cart = read_json("cart.json", default={})
    except Exception:
        source_cart = {}

    if not isinstance(source_cart, dict) or not source_cart:
        return

    now_ts = int(time.time())
    with session_maker() as session:
        for user_key, rows in source_cart.items():
            try:
                user_id = int(user_key)
            except (TypeError, ValueError):
                continue
            if not isinstance(rows, list):
                continue
            for item in rows:
                if not isinstance(item, dict):
                    continue
                product_id = int(item.get("product_id", 0) or 0)
                quantity = int(item.get("quantity", 0) or 0)
                if product_id <= 0 or quantity <= 0:
                    continue
                session.execute(
                    text(
                        """
                        INSERT INTO cart_items (user_id, product_id, quantity, updated_at)
                        VALUES (:user_id, :product_id, :quantity, :updated_at)
                        """
                    ),
                    {
                        "user_id": user_id,
                        "product_id": product_id,
                        "quantity": quantity,
                        "updated_at": now_ts,
                    },
                )
        session.commit()


def seed_orders_from_json_if_empty() -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        count = session.execute(text("SELECT COUNT(*) AS c FROM orders")).mappings().first()
        if int((count or {}).get("c", 0) or 0) > 0:
            return

    try:
        try:
            from .database import read_json
        except ImportError:
            from database import read_json
        source_orders = read_json("orders.json", default={})
    except Exception:
        source_orders = {}

    if not isinstance(source_orders, dict) or not source_orders:
        return

    with session_maker() as session:
        for user_key, orders in source_orders.items():
            try:
                user_id = int(user_key)
            except (TypeError, ValueError):
                continue
            if not isinstance(orders, list):
                continue
            for order in orders:
                if not isinstance(order, dict):
                    continue
                order_id = str(order.get("id", ""))
                if not order_id:
                    continue

                created_raw = order.get("created_at")
                try:
                    created_at = datetime.fromisoformat(str(created_raw))
                except Exception:
                    created_at = datetime.now(timezone.utc)
                expected_raw = order.get("expected_delivery_at")
                try:
                    expected_at = datetime.fromisoformat(str(expected_raw))
                except Exception:
                    expected_at = created_at

                session.execute(
                    text(
                        """
                        INSERT INTO orders (
                            id, user_id, status, created_at, payment_method, payment_details_json, address_id,
                            shipping_address_json, notes, currency, total_amount, expected_delivery_at
                        ) VALUES (
                            :id, :user_id, :status, :created_at, :payment_method, :payment_details_json, :address_id,
                            :shipping_address_json, :notes, :currency, :total_amount, :expected_delivery_at
                        )
                        """
                    ),
                    {
                        "id": order_id,
                        "user_id": user_id,
                        "status": str(order.get("status", "")),
                        "created_at": created_at,
                        "payment_method": str(order.get("payment_method", "")),
                        "payment_details_json": json.dumps(order.get("payment_details", {}) or {}, ensure_ascii=True),
                        "address_id": order.get("address_id"),
                        "shipping_address_json": json.dumps(order.get("shipping_address", {}) or {}, ensure_ascii=True),
                        "notes": order.get("notes"),
                        "currency": str(order.get("currency", "")),
                        "total_amount": float(order.get("total_amount", 0) or 0),
                        "expected_delivery_at": expected_at,
                    },
                )

                for item in order.get("items", []) or []:
                    if not isinstance(item, dict):
                        continue
                    session.execute(
                        text(
                            """
                            INSERT INTO order_items (
                                order_id, product_id, product_name, unit_price, quantity, line_total
                            ) VALUES (
                                :order_id, :product_id, :product_name, :unit_price, :quantity, :line_total
                            )
                            """
                        ),
                        {
                            "order_id": order_id,
                            "product_id": int(item.get("product_id", 0) or 0),
                            "product_name": str(item.get("product_name", "")),
                            "unit_price": float(item.get("unit_price", 0) or 0),
                            "quantity": int(item.get("quantity", 0) or 0),
                            "line_total": float(item.get("line_total", 0) or 0),
                        },
                    )

                for event in order.get("tracking_events", []) or []:
                    if not isinstance(event, dict):
                        continue
                    ts_raw = event.get("timestamp")
                    if ts_raw:
                        try:
                            ts_parsed = datetime.fromisoformat(str(ts_raw))
                        except Exception:
                            ts_parsed = None
                    else:
                        ts_parsed = None
                    session.execute(
                        text(
                            """
                            INSERT INTO order_tracking_events (order_id, stage, status, timestamp)
                            VALUES (:order_id, :stage, :status, :timestamp)
                            """
                        ),
                        {
                            "order_id": order_id,
                            "stage": str(event.get("stage", "")),
                            "status": str(event.get("status", "")),
                            "timestamp": ts_parsed,
                        },
                    )

        session.commit()


def seed_style_quiz_from_json_if_empty() -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        count = session.execute(text("SELECT COUNT(*) AS c FROM style_quiz_profiles")).mappings().first()
        if int((count or {}).get("c", 0) or 0) > 0:
            return

    try:
        try:
            from .database import read_json
        except ImportError:
            from database import read_json
        source_profiles = read_json("style_quiz_profiles.json", default={})
    except Exception:
        source_profiles = {}

    if not isinstance(source_profiles, dict) or not source_profiles:
        return

    with session_maker() as session:
        for user_key, profile in source_profiles.items():
            try:
                user_id = int(user_key)
            except (TypeError, ValueError):
                continue
            if not isinstance(profile, dict):
                continue
            session.execute(
                text(
                    """
                    INSERT INTO style_quiz_profiles (
                        user_id, preferred_categories_json, preferred_colors_json, preferred_materials_json,
                        budget_max, occasions_json, updated_at
                    ) VALUES (
                        :user_id, :preferred_categories_json, :preferred_colors_json, :preferred_materials_json,
                        :budget_max, :occasions_json, :updated_at
                    )
                    """
                ),
                {
                    "user_id": user_id,
                    "preferred_categories_json": json.dumps(profile.get("preferred_categories", []) or [], ensure_ascii=True),
                    "preferred_colors_json": json.dumps(profile.get("preferred_colors", []) or [], ensure_ascii=True),
                    "preferred_materials_json": json.dumps(profile.get("preferred_materials", []) or [], ensure_ascii=True),
                    "budget_max": profile.get("budget_max"),
                    "occasions_json": json.dumps(profile.get("occasions", []) or [], ensure_ascii=True),
                    "updated_at": int(profile.get("updated_at", int(time.time()))),
                },
            )
        session.commit()


def seed_recommendation_events_from_json_if_empty() -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        count = session.execute(text("SELECT COUNT(*) AS c FROM recommendation_events")).mappings().first()
        if int((count or {}).get("c", 0) or 0) > 0:
            return

    try:
        try:
            from .database import read_json
        except ImportError:
            from database import read_json
        source_events = read_json("recommendation_events.json", default={"views": {}, "searches": {}})
    except Exception:
        source_events = {"views": {}, "searches": {}}

    if not isinstance(source_events, dict) or not source_events:
        return

    views = source_events.get("views", {})
    searches = source_events.get("searches", {})
    with session_maker() as session:
        if isinstance(views, dict):
            for user_key, rows in views.items():
                try:
                    user_id = int(user_key)
                except (TypeError, ValueError):
                    continue
                if not isinstance(rows, list):
                    continue
                for entry in rows:
                    if not isinstance(entry, dict):
                        continue
                    product_id = int(entry.get("product_id", 0) or 0)
                    if product_id <= 0:
                        continue
                    session.execute(
                        text(
                            """
                            INSERT INTO recommendation_events (user_id, event_type, product_id, query_text, created_at)
                            VALUES (:user_id, 'view', :product_id, NULL, :created_at)
                            """
                        ),
                        {
                            "user_id": user_id,
                            "product_id": product_id,
                            "created_at": int(entry.get("timestamp", int(time.time()))),
                        },
                    )
        if isinstance(searches, dict):
            for user_key, rows in searches.items():
                try:
                    user_id = int(user_key)
                except (TypeError, ValueError):
                    continue
                if not isinstance(rows, list):
                    continue
                for entry in rows:
                    if not isinstance(entry, dict):
                        continue
                    query = str(entry.get("query", "")).strip()
                    if not query:
                        continue
                    session.execute(
                        text(
                            """
                            INSERT INTO recommendation_events (user_id, event_type, product_id, query_text, created_at)
                            VALUES (:user_id, 'search', NULL, :query_text, :created_at)
                            """
                        ),
                        {
                            "user_id": user_id,
                            "query_text": query,
                            "created_at": int(entry.get("timestamp", int(time.time()))),
                        },
                    )
        session.commit()


def seed_contact_messages_from_json_if_empty() -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        count = session.execute(text("SELECT COUNT(*) AS c FROM contact_messages")).mappings().first()
        if int((count or {}).get("c", 0) or 0) > 0:
            return

    try:
        try:
            from .database import read_json
        except ImportError:
            from database import read_json
        source_messages = read_json("contact_messages.json", default=[])
    except Exception:
        source_messages = []

    if not isinstance(source_messages, list) or not source_messages:
        return

    with session_maker() as session:
        for entry in source_messages:
            if not isinstance(entry, dict):
                continue
            created_raw = entry.get("created_at")
            try:
                created_at = datetime.fromisoformat(str(created_raw))
            except Exception:
                created_at = datetime.now(timezone.utc)
            session.execute(
                text(
                    """
                    INSERT INTO contact_messages (
                        created_at, user_id, session_id, name, email, phone, subject, message
                    ) VALUES (
                        :created_at, :user_id, :session_id, :name, :email, :phone, :subject, :message
                    )
                    """
                ),
                {
                    "created_at": created_at,
                    "user_id": entry.get("user_id"),
                    "session_id": entry.get("session_id"),
                    "name": str(entry.get("name", "")),
                    "email": str(entry.get("email", "")),
                    "phone": str(entry.get("phone", "")) if entry.get("phone") else None,
                    "subject": str(entry.get("subject", "")),
                    "message": str(entry.get("message", "")),
                },
            )
        session.commit()


def fetch_user_by_email(email: str) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        row = session.execute(
            text(
                """
                SELECT id, name, email, salt, password_hash, is_admin, created_at
                FROM users
                WHERE email = :email
                LIMIT 1
                """
            ),
            {"email": email},
        ).mappings().first()

    return dict(row) if row else None


def create_user(
    *,
    name: str,
    email: str,
    salt: str,
    password_hash: str,
    is_admin: bool = False,
    created_at: int,
) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        session.execute(
            text(
                """
                INSERT INTO users (name, email, salt, password_hash, is_admin, created_at)
                VALUES (:name, :email, :salt, :password_hash, :is_admin, :created_at)
                """
            ),
            {
                "name": name,
                "email": email,
                "salt": salt,
                "password_hash": password_hash,
                "is_admin": 1 if is_admin else 0,
                "created_at": created_at,
            },
        )
        session.commit()

        row = session.execute(
            text(
                """
                SELECT id, name, email, salt, password_hash, is_admin, created_at
                FROM users
                WHERE email = :email
                LIMIT 1
                """
            ),
            {"email": email},
        ).mappings().first()

    return dict(row) if row else None


def upsert_admin_user(
    *,
    name: str,
    email: str,
    salt: str,
    password_hash: str,
    created_at: int,
) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()

    with session_maker() as session:
        session.execute(
            text(
                """
                INSERT INTO users (name, email, salt, password_hash, is_admin, created_at)
                VALUES (:name, :email, :salt, :password_hash, 1, :created_at)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    salt = VALUES(salt),
                    password_hash = VALUES(password_hash),
                    is_admin = 1
                """
            ),
            {
                "name": name,
                "email": email,
                "salt": salt,
                "password_hash": password_hash,
                "created_at": created_at,
            },
        )
        session.commit()

    return fetch_user_by_email(email)


def list_users_mysql() -> list[dict[str, Any]]:
    setup = _ensure_engine()
    if setup is None:
        return []
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT id, name, email, is_admin, created_at
                    FROM users
                    ORDER BY created_at DESC, id DESC
                    """
                )
            )
            .mappings()
            .all()
        )
    return [
        {
            "id": int(row.get("id", 0) or 0),
            "name": str(row.get("name", "")),
            "email": str(row.get("email", "")),
            "is_admin": bool(row.get("is_admin", 0)),
            "created_at": int(row.get("created_at", 0) or 0),
        }
        for row in rows
    ]


def get_style_quiz_profile_mysql(user_id: int) -> dict[str, Any]:
    setup = _ensure_engine()
    if setup is None:
        return {}
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        row = (
            session.execute(
                text(
                    """
                    SELECT preferred_categories_json, preferred_colors_json, preferred_materials_json,
                           budget_max, occasions_json, updated_at
                    FROM style_quiz_profiles
                    WHERE user_id = :user_id
                    LIMIT 1
                    """
                ),
                {"user_id": user_id},
            )
            .mappings()
            .first()
        )
    if not row:
        return {}

    def _decode(value: Any) -> list[str]:
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        if isinstance(value, list):
            return value
        return []

    return {
        "preferred_categories": _decode(row.get("preferred_categories_json")),
        "preferred_colors": _decode(row.get("preferred_colors_json")),
        "preferred_materials": _decode(row.get("preferred_materials_json")),
        "budget_max": int(row.get("budget_max")) if row.get("budget_max") is not None else None,
        "occasions": _decode(row.get("occasions_json")),
        "updated_at": int(row.get("updated_at", 0) or 0),
    }


def save_style_quiz_profile_mysql(user_id: int, profile: dict[str, Any]) -> dict[str, Any] | None:
    setup = _ensure_engine()
    if setup is None:
        return None
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        session.execute(
            text(
                """
                INSERT INTO style_quiz_profiles (
                    user_id, preferred_categories_json, preferred_colors_json, preferred_materials_json,
                    budget_max, occasions_json, updated_at
                ) VALUES (
                    :user_id, :preferred_categories_json, :preferred_colors_json, :preferred_materials_json,
                    :budget_max, :occasions_json, :updated_at
                )
                ON DUPLICATE KEY UPDATE
                    preferred_categories_json = VALUES(preferred_categories_json),
                    preferred_colors_json = VALUES(preferred_colors_json),
                    preferred_materials_json = VALUES(preferred_materials_json),
                    budget_max = VALUES(budget_max),
                    occasions_json = VALUES(occasions_json),
                    updated_at = VALUES(updated_at)
                """
            ),
            {
                "user_id": user_id,
                "preferred_categories_json": json.dumps(profile.get("preferred_categories", []) or [], ensure_ascii=True),
                "preferred_colors_json": json.dumps(profile.get("preferred_colors", []) or [], ensure_ascii=True),
                "preferred_materials_json": json.dumps(profile.get("preferred_materials", []) or [], ensure_ascii=True),
                "budget_max": profile.get("budget_max"),
                "occasions_json": json.dumps(profile.get("occasions", []) or [], ensure_ascii=True),
                "updated_at": int(profile.get("updated_at", int(time.time()))),
            },
        )
        session.commit()
    return get_style_quiz_profile_mysql(user_id)


def record_view_event_mysql(user_id: int, product_id: int, timestamp: int | None = None) -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        session.execute(
            text(
                """
                INSERT INTO recommendation_events (user_id, event_type, product_id, query_text, created_at)
                VALUES (:user_id, 'view', :product_id, NULL, :created_at)
                """
            ),
            {
                "user_id": user_id,
                "product_id": product_id,
                "created_at": int(timestamp or int(time.time())),
            },
        )
        session.commit()


def record_search_event_mysql(user_id: int, query: str, timestamp: int | None = None) -> None:
    setup = _ensure_engine()
    if setup is None:
        return
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        session.execute(
            text(
                """
                INSERT INTO recommendation_events (user_id, event_type, product_id, query_text, created_at)
                VALUES (:user_id, 'search', NULL, :query_text, :created_at)
                """
            ),
            {
                "user_id": user_id,
                "query_text": str(query),
                "created_at": int(timestamp or int(time.time())),
            },
        )
        session.commit()


def load_recommendation_events_mysql() -> dict[str, Any]:
    setup = _ensure_engine()
    if setup is None:
        return {"views": {}, "searches": {}}
    _, session_maker = setup
    _, text, _ = _import_sqlalchemy()
    with session_maker() as session:
        rows = (
            session.execute(
                text(
                    """
                    SELECT user_id, event_type, product_id, query_text, created_at
                    FROM recommendation_events
                    ORDER BY created_at ASC, id ASC
                    """
                )
            )
            .mappings()
            .all()
        )
    views: dict[str, list[dict[str, Any]]] = {}
    searches: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        key = str(int(row.get("user_id", 0) or 0))
        if row.get("event_type") == "view":
            views.setdefault(key, []).append(
                {
                    "product_id": int(row.get("product_id", 0) or 0),
                    "timestamp": int(row.get("created_at", 0) or 0),
                }
            )
        elif row.get("event_type") == "search":
            searches.setdefault(key, []).append(
                {
                    "query": str(row.get("query_text", "")),
                    "timestamp": int(row.get("created_at", 0) or 0),
                }
            )
    return {"views": views, "searches": searches}

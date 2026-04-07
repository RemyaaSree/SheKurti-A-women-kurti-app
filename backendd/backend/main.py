from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

try:
    from .routes.auth import router as auth_router
    from .database import ensure_data_files
    from .mysql_db import init_mysql_schema, mysql_available, mysql_error, mysql_ping
    from .routes.cart import router as cart_router
    from .routes.chat import router as chat_router
    from .routes.orders import router as orders_router
    from .routes.pages import router as pages_router
    from .routes.profile import router as profile_router
    from .routes.products import router as products_router
    from .routes.recommendations import router as recommendations_router
except ImportError:
    from routes.auth import router as auth_router
    from database import ensure_data_files
    from mysql_db import init_mysql_schema, mysql_available, mysql_error, mysql_ping
    from routes.cart import router as cart_router
    from routes.chat import router as chat_router
    from routes.orders import router as orders_router
    from routes.pages import router as pages_router
    from routes.profile import router as profile_router
    from routes.products import router as products_router
    from routes.recommendations import router as recommendations_router

ensure_data_files()
init_mysql_schema()

app = FastAPI(title="SheKurti Backend", version="1.0.0")

allowed_origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ASSETS_DIR = Path(__file__).resolve().parents[2] / "chudi" / "src" / "assets"
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "SheKurti backend is running"}


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "mysql": "connected" if mysql_available() else "disabled",
        "mysql_error": mysql_error() or "",
    }

@app.get("/test-db")
def test_db() -> dict[str, str]:
    ok, error_message = mysql_ping()
    return {
        "status": "ok" if ok else "error",
        "mysql": "connected" if ok else "disconnected",
        "message": "MySQL connection successful" if ok else "MySQL connection failed",
        "error": error_message,
    }


app.include_router(products_router)
app.include_router(pages_router)
app.include_router(cart_router)
app.include_router(profile_router)
app.include_router(orders_router)
app.include_router(auth_router)
app.include_router(recommendations_router)
app.include_router(chat_router)

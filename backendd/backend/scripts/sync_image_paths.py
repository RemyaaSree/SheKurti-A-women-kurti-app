from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable
from urllib.parse import quote, unquote

from sqlalchemy import create_engine, text


def _database_url() -> str:
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "remyaa")
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = os.getenv("DB_PORT", "3306")
    name = os.getenv("DB_NAME", "shekurti")
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}?charset=utf8mb4"


def _iter_image_files(root: Path) -> Iterable[Path]:
    exts = {".png", ".jpg", ".jpeg", ".webp"}
    for path in root.rglob("*"):
        if path.is_file() and path.suffix.lower() in exts:
            yield path


def _build_asset_index(root: Path) -> dict[str, list[str]]:
    index: dict[str, list[str]] = {}
    for path in _iter_image_files(root):
        rel = path.relative_to(root).as_posix()
        key = path.name.lower()
        index.setdefault(key, []).append(rel)
    return index


def _pick_candidate(candidates: list[str], hint: str | None) -> str:
    if not candidates:
        return ""
    if hint:
        hint_lower = hint.lower()
        for candidate in candidates:
            if hint_lower in candidate.lower():
                return candidate
    return candidates[0]


def _normalize_url(url: str) -> str:
    # Ensure /assets/... with encoded spaces, keeping slashes.
    return quote(url.replace("\\", "/"), safe="/")


def _sync_table(engine, table: str, assets_index: dict[str, list[str]]) -> int:
    updated = 0
    with engine.begin() as conn:
        rows = conn.execute(text(f"SELECT id, image_url FROM {table}")).mappings().all()
        for row in rows:
            image_url = str(row.get("image_url", "") or "")
            if not image_url:
                continue
            decoded = unquote(image_url)
            filename = os.path.basename(decoded).lower()
            candidates = assets_index.get(filename, [])
            if not candidates:
                continue

            hint = None
            parts = decoded.split("/assets/")
            if len(parts) > 1:
                hint = parts[1].split("/")[0]
            rel = _pick_candidate(candidates, hint)
            if not rel:
                continue
            new_url = "/assets/" + _normalize_url(rel)
            if new_url != image_url:
                conn.execute(
                    text(f"UPDATE {table} SET image_url = :url WHERE id = :id"),
                    {"url": new_url, "id": row.get("id")},
                )
                updated += 1
    return updated


def main() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    assets_root = repo_root / "chudi" / "src" / "assets"
    if not assets_root.exists():
        raise SystemExit(f"Assets folder not found: {assets_root}")

    index = _build_asset_index(assets_root)
    engine = create_engine(_database_url(), future=True)
    updated_products = _sync_table(engine, "products", index)
    engine.dispose()

    print(f"Updated products: {updated_products}")


if __name__ == "__main__":
    main()

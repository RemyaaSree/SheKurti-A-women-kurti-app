from __future__ import annotations

import math
import re
import time
import uuid
import zlib
from pathlib import Path
from urllib.parse import quote, unquote

from fastapi import APIRouter, File, Header, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field

try:
    from ..auth_utils import get_user_from_authorization
    from ..database import read_json, write_json
    from ..mysql_db import (
        create_product_mysql,
        delete_product_mysql,
        get_product_mysql,
        list_all_products_mysql,
        list_bottomwear_mysql,
        list_dupatta_mysql,
        list_products_mysql,
        list_product_reviews_mysql,
        record_view_event_mysql,
        mysql_available,
        create_product_review_mysql,
        user_has_purchased_product_mysql,
        update_product_mysql,
    )
except ImportError:
    from auth_utils import get_user_from_authorization
    from database import read_json, write_json
    from mysql_db import (
        create_product_mysql,
        delete_product_mysql,
        get_product_mysql,
        list_all_products_mysql,
        list_bottomwear_mysql,
        list_dupatta_mysql,
        list_products_mysql,
        list_product_reviews_mysql,
        record_view_event_mysql,
        mysql_available,
        create_product_review_mysql,
        user_has_purchased_product_mysql,
        update_product_mysql,
    )

router = APIRouter(prefix="/products", tags=["products"])
ASSETS_DIR = Path(__file__).resolve().parents[3] / "chudi" / "src" / "assets"
SECTION_FOLDER_MAP = {
    "new-arrivals": "new_arivals",
    "new_arivals": "new_arivals",
    "anarkali": "anarkali",
    "formal": "formal",
    "casual": "casual",
    "chikankari": "chikankari",
    "silk": "silk",
    "kurtis": "kurtis",
    "sets": "sets",
    "fabrics": "fabric",
    "fabric": "fabric",
    "budget": "budget",
    "short": "short",
}
DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"]
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}

CATEGORY_KEYWORDS: dict[str, set[str]] = {
    "Anarkali": {"anarkali", "festive", "party", "wedding", "flared"},
    "Casual": {"casual", "daily", "everyday", "comfort"},
    "Chikankari": {"chikankari", "embroidered", "threadwork", "lucknowi"},
    "Formal": {"formal", "office", "work", "corporate", "professional"},
    "Short": {"short", "tunic"},
    "Silk": {"silk", "premium", "luxury", "grand"},
}

MATERIAL_KEYWORDS: dict[str, set[str]] = {
    "Cotton": {"cotton", "breathable", "lightweight"},
    "Rayon": {"rayon", "office"},
    "Georgette": {"georgette", "flowy", "drape"},
    "Silk": {"silk", "premium", "festive"},
    "Pure Silk": {"pure", "silk"},
}

COLOR_TOKENS = {
    "blue",
    "green",
    "maroon",
    "peach",
    "pink",
    "teal",
    "white",
    "yellow",
}

TOKEN_SYNONYMS: dict[str, set[str]] = {
    "office": {"formal", "work", "corporate"},
    "work": {"formal", "office", "corporate"},
    "party": {"festive", "anarkali", "silk"},
    "daily": {"casual", "cotton"},
    "premium": {"silk", "formal"},
    "comfortable": {"casual", "cotton"},
}

SIZE_MAP: dict[str, str] = {
    "xs": "XS",
    "extra small": "XS",
    "small": "S",
    "s": "S",
    "medium": "M",
    "m": "M",
    "large": "L",
    "l": "L",
    "extra large": "XL",
    "xl": "XL",
    "xxl": "XXL",
    "double xl": "XXL",
}

CATEGORY_QUERY_MAP: dict[str, set[str]] = {
    "party": {"Anarkali", "Silk"},
    "party wear": {"Anarkali", "Silk"},
    "festive": {"Anarkali", "Silk"},
    "office": {"Formal"},
    "office wear": {"Formal"},
    "work": {"Formal"},
    "daily": {"Casual", "Chikankari"},
    "casual": {"Casual"},
    "short": {"Short"},
    "silk": {"Silk"},
    "anarkali": {"Anarkali"},
    "chikankari": {"Chikankari"},
}


class AISearchRequest(BaseModel):
    query: str | None = None
    source: str | None = None
    dominant_color: str | None = None
    visual_tags: list[str] = Field(default_factory=list)
    candidate_product_ids: list[int] = Field(default_factory=list)
    structured_filters: dict[str, str | float | int | None] = Field(default_factory=dict)
    limit: int = Field(default=24, ge=1, le=48)


class ProductAdminPayload(BaseModel):
    id: int | None = Field(default=None, gt=0)
    name: str = Field(min_length=2, max_length=255)
    price: float = Field(gt=0)
    original_price: float = Field(gt=0)
    image_url: str = Field(min_length=1, max_length=1200)
    category: str = Field(min_length=1, max_length=120)
    color: str = Field(min_length=1, max_length=80)
    material: str = Field(min_length=1, max_length=120)
    sizes: list[str] = Field(default_factory=list)
    rating: float = Field(ge=0, le=5)
    reviews: int = Field(ge=0)
    description: str = Field(min_length=1, max_length=5000)


class ProductReviewPayload(BaseModel):
    rating: float = Field(ge=1, le=5)
    title: str = Field(min_length=2, max_length=150)
    comment: str = Field(min_length=3, max_length=2000)


def _tokenize(text: str | None) -> set[str]:
    if not text:
        return set()
    return {token for token in re.findall(r"[a-zA-Z]+", text.lower()) if token}


def _expand_tokens(tokens: set[str]) -> set[str]:
    expanded = set(tokens)
    for token in list(tokens):
        expanded.update(TOKEN_SYNONYMS.get(token, set()))
    return expanded


def _inferred_attributes(tokens: set[str]) -> dict[str, set[str]]:
    categories = {
        category
        for category, keywords in CATEGORY_KEYWORDS.items()
        if tokens.intersection(keywords)
    }
    materials = {
        material
        for material, keywords in MATERIAL_KEYWORDS.items()
        if tokens.intersection(keywords)
    }
    colors = {token.capitalize() for token in tokens if token in COLOR_TOKENS}
    return {"categories": categories, "materials": materials, "colors": colors}


def _extract_smart_filters(
    query: str | None,
    base_inferred: dict[str, set[str]],
) -> dict[str, str | list[str] | float | None]:
    query_text = (query or "").strip().lower()
    extracted_colors = set(base_inferred["colors"])
    extracted_categories = set(base_inferred["categories"])
    extracted_size: str | None = None
    extracted_max_price: float | None = None

    # Multi-word category intents first.
    for phrase, mapped_categories in CATEGORY_QUERY_MAP.items():
        if phrase in query_text:
            extracted_categories.update(mapped_categories)

    # Size extraction from free text.
    for token, normalized in SIZE_MAP.items():
        if re.search(rf"\b{re.escape(token)}\b", query_text):
            extracted_size = normalized
            break

    price_match = re.search(r"\bunder\s+(\d{2,6})\b", query_text)
    if price_match:
        extracted_max_price = float(price_match.group(1))

    # If direct color words exist in query, keep them explicit.
    for color in COLOR_TOKENS:
        if re.search(rf"\b{re.escape(color)}\b", query_text):
            extracted_colors.add(color.capitalize())

    return {
        "color": sorted(extracted_colors)[0] if extracted_colors else None,
        "categories": sorted(extracted_categories),
        "size": extracted_size,
        "max_price": extracted_max_price,
    }


def _merge_structured_filters(
    smart_filters: dict[str, str | list[str] | float | None],
    structured_filters: dict[str, str | float | int | None],
) -> dict[str, str | list[str] | float | None]:
    merged: dict[str, str | list[str] | float | None] = dict(smart_filters)

    color = structured_filters.get("color")
    if isinstance(color, str) and color.strip():
        merged["color"] = color.strip().capitalize()

    category = structured_filters.get("category")
    if isinstance(category, str) and category.strip():
        token = category.strip().lower()
        inferred_categories = CATEGORY_QUERY_MAP.get(token)
        if inferred_categories:
            merged["categories"] = sorted(inferred_categories)
        else:
            merged["categories"] = [category.strip().title()]

    size = structured_filters.get("size")
    if isinstance(size, str) and size.strip():
        normalized_size = SIZE_MAP.get(size.strip().lower(), size.strip().upper())
        merged["size"] = normalized_size

    min_price = structured_filters.get("min_price")
    if isinstance(min_price, (int, float)):
        merged["min_price"] = float(min_price)

    max_price = structured_filters.get("max_price")
    if isinstance(max_price, (int, float)):
        merged["max_price"] = float(max_price)

    return merged


def _apply_smart_filters(products: list[dict], smart_filters: dict[str, str | list[str] | float | None]) -> list[dict]:
    filtered = products
    target_color = smart_filters.get("color")
    target_categories = smart_filters.get("categories")
    target_size = smart_filters.get("size")
    target_min_price = smart_filters.get("min_price")
    target_max_price = smart_filters.get("max_price")

    if isinstance(target_color, str) and target_color:
        filtered = [item for item in filtered if str(item.get("color", "")).lower() == target_color.lower()]

    if isinstance(target_categories, list) and target_categories:
        allowed = {str(category) for category in target_categories}
        filtered = [item for item in filtered if str(item.get("category", "")) in allowed]

    if isinstance(target_size, str) and target_size:
        filtered = [
            item
            for item in filtered
            if target_size in [str(size).upper() for size in item.get("sizes", []) if isinstance(size, str)]
        ]

    if isinstance(target_min_price, (int, float)):
        filtered = [item for item in filtered if float(item.get("price", 0) or 0) >= float(target_min_price)]

    if isinstance(target_max_price, (int, float)):
        filtered = [item for item in filtered if float(item.get("price", 0) or 0) <= float(target_max_price)]

    return filtered


def _score_product(product: dict, tokens: set[str], inferred: dict[str, set[str]]) -> tuple[float, list[str]]:
    score = 0.0
    reasons: list[str] = []

    name = str(product.get("name", "")).lower()
    description = str(product.get("description", "")).lower()
    category = str(product.get("category", ""))
    material = str(product.get("material", ""))
    color = str(product.get("color", ""))
    rating = float(product.get("rating", 0) or 0)
    reviews = int(product.get("reviews", 0) or 0)

    if category in inferred["categories"]:
        score += 4.2
        reasons.append(f"Matches style intent: {category}")
    if material in inferred["materials"]:
        score += 2.5
        reasons.append(f"Material preference: {material}")
    if color in inferred["colors"]:
        score += 3.4
        reasons.append(f"Color match: {color}")

    token_matches = 0
    for token in tokens:
        if token in name:
            score += 1.8
            token_matches += 1
        elif token in description:
            score += 1.2
            token_matches += 1
    if token_matches > 0:
        reasons.append(f"Keyword relevance: {token_matches} match(es)")

    score += min(2.0, rating * 0.4)
    score += min(1.6, math.log(reviews + 1) * 0.25)

    if not reasons:
        reasons.append("Recommended by popularity score")

    return score, reasons


def _attach_absolute_image_url(product: dict, request: Request) -> dict:
    image_url = product.get("image_url")
    if isinstance(image_url, str):
        base = str(request.base_url).rstrip("/")
        if image_url.startswith("/"):
            absolute = base + image_url
            return {**product, "image_url": absolute}
        if image_url.startswith("assets/"):
            absolute = f"{base}/{image_url}"
            return {**product, "image_url": absolute}
    return product


def _guess_color_from_name(text: str) -> str:
    lower = text.lower()
    color_aliases = {
        "blue": "Blue",
        "green": "Green",
        "maroon": "Maroon",
        "peach": "Peach",
        "pink": "Pink",
        "teal": "Teal",
        "white": "White",
        "yellow": "Yellow",
        "black": "Black",
        "purple": "Purple",
        "orange": "Orange",
        "grey": "Grey",
        "gray": "Grey",
        "brown": "Brown",
        "mustard": "Mustard",
        "red": "Red",
        "magenta": "Magenta",
    }
    for token, mapped in color_aliases.items():
        if token in lower:
            return mapped
    return "Mixed"


def _guess_material_from_name(text: str, folder_name: str) -> str:
    lower = text.lower()
    material_aliases = {
        "cotton": "Cotton",
        "rayon": "Rayon",
        "georgette": "Georgette",
        "silk": "Silk",
        "crepe": "Crepe",
        "linen": "Linen",
        "chiffon": "Chiffon",
        "viscose": "Viscose",
    }
    for token, mapped in material_aliases.items():
        if token in lower:
            return mapped

    if folder_name == "fabric":
        return "Blend"
    if folder_name == "sets":
        return "Silk"
    if folder_name == "anarkali":
        return "Silk"
    if folder_name == "formal":
        return "Rayon"
    if folder_name == "casual":
        return "Cotton"
    if folder_name == "chikankari":
        return "Cotton"
    if folder_name == "silk":
        return "Pure Silk"
    if folder_name == "short":
        return "Georgette"
    return "Cotton"


def _humanize_image_stem(stem: str) -> str:
    cleaned = re.sub(r"[_\-]+", " ", stem).strip()
    cleaned = re.sub(r"\d+", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.title()


def _build_dynamic_product_name(folder_name: str, stable_id: int, stem: str) -> str:
    collection_name_map = {
        "new_arivals": "New Arrival",
        "anarkali": "Anarkali Kurti",
        "formal": "Formal Kurti",
        "casual": "Casual Kurti",
        "chikankari": "Chikankari Kurti",
        "silk": "Silk Kurti",
        "kurtis": "Kurti",
        "sets": "Co-Ord Set",
        "fabric": "Fabric Set",
        "budget": "Budget Kurti",
        "short": "Short Kurti",
    }
    prefixes = ["Classic", "Elegant", "Everyday", "Grace", "Heritage", "Modern", "Signature", "Timeless"]

    base = collection_name_map.get(folder_name, "Kurti")
    source_label = _humanize_image_stem(stem)
    if folder_name == "short":
        if not source_label:
            prefix = prefixes[stable_id % len(prefixes)]
            return f"{prefix} {base}"
        if "short" in source_label.lower():
            return source_label
        return f"{source_label} Short Kurti"
    if folder_name == "anarkali":
        if not source_label:
            prefix = prefixes[stable_id % len(prefixes)]
            return f"{prefix} {base}"
        if "anarkali" in source_label.lower():
            return source_label
        return f"{source_label} Anarkali Kurti"
    if folder_name == "formal":
        if not source_label:
            prefix = prefixes[stable_id % len(prefixes)]
            return f"{prefix} {base}"
        if "formal" in source_label.lower() or "office wear" in source_label.lower():
            return source_label
        return f"{source_label} Formal Kurti"
    if folder_name == "casual":
        if not source_label:
            prefix = prefixes[stable_id % len(prefixes)]
            return f"{prefix} {base}"
        if "casual" in source_label.lower():
            return source_label
        return f"{source_label} Casual Kurti"
    if folder_name == "chikankari":
        if not source_label:
            prefix = prefixes[stable_id % len(prefixes)]
            return f"{prefix} {base}"
        if "chikankari" in source_label.lower():
            return source_label
        return f"{source_label} Chikankari Kurti"
    if folder_name == "silk":
        if not source_label:
            prefix = prefixes[stable_id % len(prefixes)]
            return f"{prefix} {base}"
        if "silk" in source_label.lower():
            return source_label
        return f"{source_label} Silk Kurti"
    if source_label:
        return f"{source_label} {base}"

    prefix = prefixes[stable_id % len(prefixes)]
    return f"{prefix} {base}"


def _build_section_products(section: str, existing_products: list[dict]) -> list[dict]:
    folder_name = SECTION_FOLDER_MAP.get(section.strip().lower())
    if not folder_name:
        return []

    section_dir = ASSETS_DIR / folder_name
    if not section_dir.exists() or not section_dir.is_dir():
        return []

    image_files = sorted(
        [path for path in section_dir.iterdir() if path.is_file() and path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}]
    )
    if not image_files:
        return []

    category_map = {
        "new_arivals": "New Arrivals",
        "anarkali": "Anarkali",
        "formal": "Formal",
        "casual": "Casual",
        "chikankari": "Chikankari",
        "silk": "Silk",
        "kurtis": "Kurtis",
        "sets": "Sets",
        "fabric": "Fabrics",
        "budget": "Budget",
        "short": "Short",
    }

    output: list[dict] = []
    for index, image_path in enumerate(image_files):
        stem = image_path.stem.replace("_", " ").replace("-", " ").strip()
        color = _guess_color_from_name(stem)
        category = category_map.get(folder_name, "Collection")
        material = _guess_material_from_name(stem, folder_name)
        if folder_name == "short":
            stable_seed = zlib.crc32(f"{folder_name}:{image_path.name}".encode("utf-8"))
            price = 400 + (stable_seed % 451)
        elif folder_name == "anarkali":
            stable_seed = zlib.crc32(f"{folder_name}:{image_path.name}".encode("utf-8"))
            price = 1800 + (stable_seed % 2001)
        elif folder_name == "formal":
            stable_seed = zlib.crc32(f"{folder_name}:{image_path.name}".encode("utf-8"))
            price = 700 + (stable_seed % 1001)
        elif folder_name == "casual":
            stable_seed = zlib.crc32(f"{folder_name}:{image_path.name}".encode("utf-8"))
            price = 450 + (stable_seed % 601)
        elif folder_name == "chikankari":
            stable_seed = zlib.crc32(f"{folder_name}:{image_path.name}".encode("utf-8"))
            price = 900 + (stable_seed % 901)
        elif folder_name == "silk":
            stable_seed = zlib.crc32(f"{folder_name}:{image_path.name}".encode("utf-8"))
            price = 1500 + (stable_seed % 2201)
        elif folder_name == "budget":
            price = 200 + ((index * 17) % 401)
        else:
            price = 1499 + ((index * 90) % 1600)
        stable_id = 200000 + (zlib.crc32(f"{folder_name}/{image_path.name}".encode("utf-8")) % 700000)
        product_name = _build_dynamic_product_name(folder_name, stable_id, stem)
        source_label = _humanize_image_stem(stem) or product_name
        if folder_name == "short":
            description = (
                f"Short kurti inspired by {source_label.lower()}: easy everyday styling with breathable comfort."
            )
        elif folder_name == "anarkali":
            description = (
                f"Anarkali style inspired by {source_label.lower()}: flowy festive silhouette with elegant ethnic appeal."
            )
        elif folder_name == "formal":
            description = (
                f"Formal kurti inspired by {source_label.lower()}: polished office-ready look with all-day comfort."
            )
        elif folder_name == "casual":
            description = (
                f"Casual kurti inspired by {source_label.lower()}: effortless everyday style with breathable comfort."
            )
        elif folder_name == "chikankari":
            description = (
                f"Chikankari kurti inspired by {source_label.lower()}: delicate embroidery look with graceful daily elegance."
            )
        elif folder_name == "silk":
            description = (
                f"Silk kurti inspired by {source_label.lower()}: premium festive finish with a rich elegant drape."
            )
        else:
            description = f"{category} collection piece: {product_name}."

        output.append(
            {
                "id": stable_id,
                "name": product_name,
                "price": price,
                "original_price": int(round(price * 1.25 / 10) * 10),
                "image_url": f"/assets/{quote(folder_name)}/{quote(image_path.name)}",
                "category": category,
                "color": color,
                "material": material,
                "sizes": DEFAULT_SIZES,
                "rating": round(4.1 + ((index * 3) % 8) / 10, 1),
                "reviews": 65 + ((index * 19) % 230),
                "description": description,
            }
        )

    return sorted(output, key=lambda item: str(item.get("name", "")).lower())


def _build_all_dynamic_section_products(existing_products: list[dict]) -> list[dict]:
    all_items: list[dict] = []
    seen_ids: set[int] = set()
    for section_key in SECTION_FOLDER_MAP:
        section_items = _build_section_products(section_key, existing_products)
        for item in section_items:
            item_id = int(item.get("id", 0) or 0)
            if item_id <= 0 or item_id in seen_ids:
                continue
            seen_ids.add(item_id)
            all_items.append(item)
    return all_items


def _has_existing_asset(product: dict) -> bool:
    image_url = product.get("image_url")
    if not isinstance(image_url, str) or not image_url.strip():
        return False

    # Keep external URLs or non-assets paths untouched.
    if not image_url.startswith("/assets/"):
        return True

    relative_path = unquote(image_url[len("/assets/") :]).replace("\\", "/").lstrip("/")
    candidate = (ASSETS_DIR / relative_path).resolve()
    try:
        candidate.relative_to(ASSETS_DIR.resolve())
    except ValueError:
        return False
    return candidate.exists() and candidate.is_file()


def _filter_existing(products: list[dict]) -> list[dict]:
    return [item for item in products if isinstance(item, dict)]


def _load_bottomwear_products() -> list[dict]:
    if mysql_available():
        bottomwear = list_bottomwear_mysql()
    else:
        bottomwear = read_json("bottomwear_products.json", default=[])
    if not isinstance(bottomwear, list):
        return []
    return _dedupe_products(_filter_existing(bottomwear))


def _load_dupatta_products() -> list[dict]:
    if mysql_available():
        dupattas = list_dupatta_mysql()
    else:
        dupattas = read_json("dupatta_products.json", default=[])
    if not isinstance(dupattas, list):
        return []
    return _dedupe_products(_filter_existing(dupattas))


def _load_base_products() -> list[dict]:
    if mysql_available():
        products = list_products_mysql()
    else:
        products = read_json("products.json", default=[])
    if not isinstance(products, list) or not products:
        return []
    return _dedupe_products(_filter_existing(products))


def _load_all_products() -> list[dict]:
    if mysql_available():
        products = list_all_products_mysql()
    else:
        products = read_json("products.json", default=[])
        bottomwear = read_json("bottomwear_products.json", default=[])
        if isinstance(bottomwear, list):
            products = products + bottomwear
    if not isinstance(products, list) or not products:
        return []
    return _dedupe_products(_filter_existing(products))


def _normalize_product_name(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", value.strip().lower())


def _normalize_product_image_key(value: object) -> str:
    if not isinstance(value, str):
        return ""
    raw = value.strip()
    if not raw:
        return ""

    # Use relative asset path key to dedupe absolute and relative references equally.
    if "/assets/" in raw:
        _, tail = raw.split("/assets/", 1)
        return f"/assets/{unquote(tail).strip().lower()}"
    return unquote(raw).strip().lower()


def _dedupe_products(products: list[dict]) -> list[dict]:
    deduped: list[dict] = []
    seen_names: set[str] = set()
    seen_images: set[str] = set()
    for item in products:
        if not isinstance(item, dict):
            continue
        normalized_name = _normalize_product_name(item.get("name"))
        normalized_image = _normalize_product_image_key(item.get("image_url"))
        if normalized_name and normalized_name in seen_names:
            continue
        if normalized_image and normalized_image in seen_images:
            continue
        if normalized_name:
            seen_names.add(normalized_name)
        if normalized_image:
            seen_images.add(normalized_image)
        deduped.append(item)
    return deduped


def _next_product_id(existing_products: list[dict]) -> int:
    max_id = 0
    for product in existing_products:
        try:
            max_id = max(max_id, int(product.get("id", 0) or 0))
        except Exception:
            continue
    return max_id + 1


def _track_product_view(user_id: int, product_id: int) -> None:
    if mysql_available():
        record_view_event_mysql(user_id, product_id, int(time.time()))
        return

    events = read_json("recommendation_events.json", default={"views": {}, "searches": {}})
    if not isinstance(events, dict):
        events = {"views": {}, "searches": {}}

    views = events.get("views", {})
    if not isinstance(views, dict):
        views = {}

    user_key = str(user_id)
    history = views.get(user_key, [])
    if not isinstance(history, list):
        history = []

    history.append({"product_id": product_id, "timestamp": int(time.time())})
    views[user_key] = history[-200:]
    events["views"] = views
    write_json("recommendation_events.json", events)


def _require_admin_user(authorization: str | None) -> dict:
    user = get_user_from_authorization(authorization)
    raw = user.get("is_admin", False)
    is_admin = raw if isinstance(raw, bool) else str(raw).strip().lower() in {"1", "true", "yes", "y"}
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _save_admin_upload_image(file: UploadFile) -> str:
    original_name = file.filename or ""
    suffix = Path(original_name).suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Unsupported image type. Use png/jpg/jpeg/webp")

    target_dir = ASSETS_DIR / "admin_uploads"
    target_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{uuid.uuid4().hex}{suffix}"
    target_path = target_dir / file_name

    content = file.file.read()
    if not content:
        raise HTTPException(status_code=422, detail="Empty image file")

    target_path.write_bytes(content)
    return f"/assets/admin_uploads/{quote(file_name)}"


@router.get("/")
def get_products(
    request: Request,
    search: str | None = Query(default=None),
    section: str | None = Query(default=None),
    category: str | None = Query(default=None),
    color: str | None = Query(default=None),
    material: str | None = Query(default=None),
    size: str | None = Query(default=None),
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    sort: str | None = Query(default=None),
):
    products = _dedupe_products(_load_base_products())
    dynamic_products = _build_all_dynamic_section_products(products)
    if dynamic_products:
        existing_ids = {int(item.get("id", 0) or 0) for item in products}
        existing_names = {
            _normalize_product_name(item.get("name"))
            for item in products
            if _normalize_product_name(item.get("name"))
        }
        existing_images = {
            _normalize_product_image_key(item.get("image_url"))
            for item in products
            if _normalize_product_image_key(item.get("image_url"))
        }
        for item in dynamic_products:
            item_id = int(item.get("id", 0) or 0)
            normalized_name = _normalize_product_name(item.get("name"))
            normalized_image = _normalize_product_image_key(item.get("image_url"))
            if (
                item_id <= 0
                or item_id in existing_ids
                or (normalized_name and normalized_name in existing_names)
                or (normalized_image and normalized_image in existing_images)
            ):
                continue
            existing_ids.add(item_id)
            if normalized_name:
                existing_names.add(normalized_name)
            if normalized_image:
                existing_images.add(normalized_image)
            products.append(item)

    if section:
        section_products = _build_section_products(section, products)
        if section_products:
            products = section_products

    filtered = products

    if search:
        search_lower = search.strip().lower()
        filtered = [
            item
            for item in filtered
            if search_lower in item.get("name", "").lower()
            or search_lower in item.get("description", "").lower()
        ]

    if category:
        filtered = [item for item in filtered if item.get("category") == category]

    if color:
        filtered = [item for item in filtered if item.get("color") == color]

    if material:
        filtered = [item for item in filtered if item.get("material") == material]

    if size:
        filtered = [item for item in filtered if size in item.get("sizes", [])]

    if min_price is not None:
        filtered = [item for item in filtered if item.get("price", 0) >= min_price]

    if max_price is not None:
        filtered = [item for item in filtered if item.get("price", 0) <= max_price]

    if sort == "price-low":
        filtered.sort(key=lambda item: item.get("price", 0))
    elif sort == "price-high":
        filtered.sort(key=lambda item: item.get("price", 0), reverse=True)
    elif sort == "rating":
        filtered.sort(key=lambda item: item.get("rating", 0), reverse=True)

    return [_attach_absolute_image_url(item, request) for item in filtered]


@router.get("/bottomwear/products")
def get_bottomwear_products(
    request: Request,
    category: str | None = Query(default=None),
):
    products = _load_bottomwear_products()
    if category:
        products = [item for item in products if str(item.get("category", "")).lower() == category.lower()]
    return [_attach_absolute_image_url(item, request) for item in products]


@router.get("/dupatta/products")
def get_dupatta_products(
    request: Request,
    category: str | None = Query(default=None),
):
    products = _load_dupatta_products()
    if category:
        products = [item for item in products if str(item.get("category", "")).lower() == category.lower()]
    return [_attach_absolute_image_url(item, request) for item in products]


@router.get("/admin/products")
def admin_list_products(authorization: str | None = Header(default=None)) -> list[dict]:
    _require_admin_user(authorization)
    products = _dedupe_products(_load_all_products())
    dynamic_products = _build_all_dynamic_section_products(products)
    if dynamic_products:
        existing_ids = {int(item.get("id", 0) or 0) for item in products}
        existing_names = {
            _normalize_product_name(item.get("name"))
            for item in products
            if _normalize_product_name(item.get("name"))
        }
        existing_images = {
            _normalize_product_image_key(item.get("image_url"))
            for item in products
            if _normalize_product_image_key(item.get("image_url"))
        }
        for item in dynamic_products:
            item_id = int(item.get("id", 0) or 0)
            normalized_name = _normalize_product_name(item.get("name"))
            normalized_image = _normalize_product_image_key(item.get("image_url"))
            if (
                item_id <= 0
                or item_id in existing_ids
                or (normalized_name and normalized_name in existing_names)
                or (normalized_image and normalized_image in existing_images)
            ):
                continue
            existing_ids.add(item_id)
            if normalized_name:
                existing_names.add(normalized_name)
            if normalized_image:
                existing_images.add(normalized_image)
            products.append(item)
    return products


@router.post("/admin/upload-image")
def admin_upload_product_image(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None),
) -> dict[str, str | bool]:
    _require_admin_user(authorization)
    image_url = _save_admin_upload_image(file)
    return {"success": True, "image_url": image_url}


@router.post("/admin/products")
def admin_create_product(payload: ProductAdminPayload, authorization: str | None = Header(default=None)) -> dict[str, bool | dict]:
    _require_admin_user(authorization)
    if not mysql_available():
        raise HTTPException(status_code=503, detail="MySQL is not available")

    existing_products = list_products_mysql()
    product_id = payload.id if payload.id is not None else _next_product_id(existing_products)
    if product_id <= 0:
        raise HTTPException(status_code=422, detail="Invalid product id")
    if get_product_mysql(product_id):
        raise HTTPException(status_code=409, detail="Product id already exists")

    data = payload.model_dump()
    data["id"] = product_id
    if not data.get("sizes"):
        data["sizes"] = DEFAULT_SIZES

    created = create_product_mysql(data)
    if not created:
        raise HTTPException(status_code=500, detail="Failed to create product")
    return {"success": True, "data": created}


@router.put("/admin/products/{product_id}")
def admin_update_product(
    product_id: int,
    payload: ProductAdminPayload,
    authorization: str | None = Header(default=None),
) -> dict[str, dict]:
    _require_admin_user(authorization)
    if not mysql_available():
        raise HTTPException(status_code=503, detail="MySQL is not available")
    if product_id <= 0:
        raise HTTPException(status_code=422, detail="Invalid product id")

    existing = get_product_mysql(product_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    data = payload.model_dump()
    data["id"] = product_id
    if not data.get("sizes"):
        data["sizes"] = existing.get("sizes", DEFAULT_SIZES)

    updated = update_product_mysql(product_id, data)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update product")
    return {"success": True, "data": updated} # type: ignore


@router.delete("/admin/products/{product_id}")
def admin_delete_product(product_id: int, authorization: str | None = Header(default=None)) -> dict[str, bool]:
    _require_admin_user(authorization)
    if not mysql_available():
        raise HTTPException(status_code=503, detail="MySQL is not available")
    if product_id <= 0:
        raise HTTPException(status_code=422, detail="Invalid product id")

    deleted = delete_product_mysql(product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True}


@router.get("/{product_id}")
def get_product(product_id: int, request: Request, authorization: str | None = Header(default=None)):
    product = None
    if mysql_available():
        product = get_product_mysql(product_id)
    if product is None:
        products = _load_base_products()
        product = next((item for item in products if item.get("id") == product_id), None)
        if product is None:
            bottomwear = _load_bottomwear_products()
            product = next((item for item in bottomwear if item.get("id") == product_id), None)
        if product is None:
            dupatta = _load_dupatta_products()
            product = next((item for item in dupatta if item.get("id") == product_id), None)
        if product is None:
            dynamic_products = _build_all_dynamic_section_products(products)
            product = next((item for item in dynamic_products if int(item.get("id", 0) or 0) == product_id), None)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    if authorization:
        try:
            user = get_user_from_authorization(authorization)
            _track_product_view(int(user["id"]), product_id)
        except HTTPException:
            # Product fetch remains public even if auth token is invalid.
            pass

    return _attach_absolute_image_url(product, request)


@router.get("/{product_id}/reviews")
def get_product_reviews(product_id: int) -> list[dict]:
    if not mysql_available():
        raise HTTPException(status_code=503, detail="MySQL is not available")
    if product_id <= 0:
        raise HTTPException(status_code=422, detail="Invalid product id")
    return list_product_reviews_mysql(product_id)


@router.post("/{product_id}/reviews")
def create_product_review(
    product_id: int,
    payload: ProductReviewPayload,
    authorization: str | None = Header(default=None),
) -> dict[str, bool | dict]:
    if not mysql_available():
        raise HTTPException(status_code=503, detail="MySQL is not available")
    if product_id <= 0:
        raise HTTPException(status_code=422, detail="Invalid product id")
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    user = get_user_from_authorization(authorization)
    user_id = int(user.get("id", 0) or 0)
    if user_id <= 0:
        raise HTTPException(status_code=401, detail="Invalid user")

    if not user_has_purchased_product_mysql(user_id, product_id):
        raise HTTPException(status_code=403, detail="Purchase required to review this product")

    created = create_product_review_mysql(
        product_id=product_id,
        user_id=user_id,
        rating=payload.rating,
        title=payload.title,
        comment=payload.comment,
    )
    if not created:
        raise HTTPException(status_code=500, detail="Failed to create review")
    return {"success": True, "data": created}


@router.post("/ai-search")
def ai_search_products(payload: AISearchRequest, request: Request):
    products = _load_base_products()

    base_tokens = _tokenize(payload.query)
    visual_tokens = set()
    for tag in payload.visual_tags:
        visual_tokens.update(_tokenize(tag))
    if payload.dominant_color:
        visual_tokens.update(_tokenize(payload.dominant_color))

    merged_tokens = _expand_tokens(base_tokens.union(visual_tokens))
    inferred = _inferred_attributes(merged_tokens)
    smart_filters = _extract_smart_filters(payload.query, inferred)
    smart_filters = _merge_structured_filters(smart_filters, payload.structured_filters)
    filtered_products = _apply_smart_filters(products, smart_filters)
    if not filtered_products:
        filtered_products = products
    prioritized_ids = {int(pid) for pid in payload.candidate_product_ids if int(pid) > 0}

    scored = []
    for product in filtered_products:
        score, reasons = _score_product(product, merged_tokens, inferred)
        if int(product.get("id", 0)) in prioritized_ids:
            score += 12.0
            reasons.insert(0, "Visual similarity match from uploaded image")
        if isinstance(smart_filters.get("categories"), list) and smart_filters["categories"]:
            reasons.insert(0, "Smart query category filter applied")
        if isinstance(smart_filters.get("color"), str) and smart_filters["color"]:
            reasons.insert(0, "Smart query color filter applied")
        if isinstance(smart_filters.get("size"), str) and smart_filters["size"]:
            reasons.insert(0, f"Smart query size filter: {smart_filters['size']}")
        max_price_value = smart_filters.get("max_price")
        if isinstance(max_price_value, (int, float)):
            reasons.insert(0, f"Price filter: under Rs {int(float(max_price_value))}")
        scored.append((score, product, reasons))

    scored.sort(
        key=lambda item: (
            item[0],
            float(item[1].get("rating", 0) or 0),
            int(item[1].get("reviews", 0) or 0),
        ),
        reverse=True,
    )

    top_results = scored[: payload.limit]
    serialized_results = []
    for _, product, reasons in top_results:
        enriched = _attach_absolute_image_url(product, request)
        serialized_results.append({**enriched, "match_reasons": reasons[:2]})

    summary_reasons: list[str] = []
    if inferred["categories"]:
        summary_reasons.append(f"Style intent: {', '.join(sorted(inferred['categories']))}")
    if inferred["materials"]:
        summary_reasons.append(f"Material intent: {', '.join(sorted(inferred['materials']))}")
    if inferred["colors"]:
        summary_reasons.append(f"Color intent: {', '.join(sorted(inferred['colors']))}")
    if not summary_reasons:
        summary_reasons.append("Ranked by semantic keywords, rating, and popularity")

    return {
        "query": payload.query or "",
        "source": payload.source or "text",
        "analysis": {
            "tokens": sorted(merged_tokens),
            "smart_filters": smart_filters,
            "inferred": {
                "categories": sorted(inferred["categories"]),
                "materials": sorted(inferred["materials"]),
                "colors": sorted(inferred["colors"]),
            },
            "summary": summary_reasons,
        },
        "count": len(serialized_results),
        "results": serialized_results,
    }

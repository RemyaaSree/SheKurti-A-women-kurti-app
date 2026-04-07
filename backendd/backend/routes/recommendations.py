from __future__ import annotations

import math
import time
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Header, Query
from pydantic import BaseModel, Field

try:
    from ..auth_utils import get_user_from_authorization
    from ..database import read_json, write_json
    from ..mysql_db import (
        get_style_quiz_profile_mysql,
        list_all_cart_mysql,
        list_all_orders_mysql,
        list_all_products_mysql,
        load_recommendation_events_mysql,
        mysql_available,
        record_search_event_mysql,
        save_style_quiz_profile_mysql,
    )
except ImportError:
    from auth_utils import get_user_from_authorization
    from database import read_json, write_json
    from mysql_db import (
        get_style_quiz_profile_mysql,
        list_all_cart_mysql,
        list_all_orders_mysql,
        list_all_products_mysql,
        load_recommendation_events_mysql,
        mysql_available,
        record_search_event_mysql,
        save_style_quiz_profile_mysql,
    )

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


class StyleQuizPayload(BaseModel):
    preferred_categories: list[str] = Field(default_factory=list, max_length=8)
    preferred_colors: list[str] = Field(default_factory=list, max_length=8)
    preferred_materials: list[str] = Field(default_factory=list, max_length=8)
    budget_max: int | None = Field(default=None, ge=200, le=10000)
    occasions: list[str] = Field(default_factory=list, max_length=8)


def _sanitize_tokens(values: list[str], cap: int = 8) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for raw in values:
        token = str(raw or "").strip()
        if not token:
            continue
        normalized = token.title()
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        output.append(normalized)
        if len(output) >= cap:
            break
    return output


def _load_style_profiles() -> dict[str, dict[str, Any]]:
    if mysql_available():
        return {}
    raw = read_json("style_quiz_profiles.json", default={})
    if isinstance(raw, dict):
        return raw
    return {}


def _save_style_profiles(store: dict[str, dict[str, Any]]) -> None:
    write_json("style_quiz_profiles.json", store)


def _get_style_profile(user_id: int) -> dict[str, Any]:
    if mysql_available():
        return get_style_quiz_profile_mysql(user_id)
    store = _load_style_profiles()
    profile = store.get(str(user_id), {})
    return profile if isinstance(profile, dict) else {}


def _quiz_profile_scores(
    style_profile: dict[str, Any],
    products: list[dict[str, Any]],
    product_map: dict[int, dict[str, Any]],
) -> tuple[dict[int, float], dict[int, list[str]]]:
    preferred_categories = {str(value).strip().lower() for value in style_profile.get("preferred_categories", [])}
    preferred_colors = {str(value).strip().lower() for value in style_profile.get("preferred_colors", [])}
    preferred_materials = {str(value).strip().lower() for value in style_profile.get("preferred_materials", [])}
    budget_max = style_profile.get("budget_max")
    budget = int(budget_max) if isinstance(budget_max, (int, float)) else None

    scores: dict[int, float] = {}
    reasons: dict[int, list[str]] = defaultdict(list)
    for item in products:
        pid = int(item.get("id", 0) or 0)
        if pid <= 0 or pid not in product_map:
            continue
        score = 0.0
        category = str(item.get("category", "")).strip().lower()
        color = str(item.get("color", "")).strip().lower()
        material = str(item.get("material", "")).strip().lower()
        price = float(item.get("price", 0) or 0)

        if preferred_categories and category in preferred_categories:
            score += 4.4
            reasons[pid].append("Matches your style quiz category")
        if preferred_colors and color in preferred_colors:
            score += 3.6
            reasons[pid].append("Matches your preferred color")
        if preferred_materials and material in preferred_materials:
            score += 2.8
            reasons[pid].append("Matches your preferred fabric")
        if budget is not None and price <= budget:
            score += 2.2
            reasons[pid].append(f"Within your budget (Rs {budget})")
        if score > 0:
            scores[pid] = score

    return scores, reasons


def _load_products() -> tuple[list[dict[str, Any]], dict[int, dict[str, Any]]]:
    if mysql_available():
        products = list_all_products_mysql()
    else:
        products = read_json("products.json", default=[])
    if not isinstance(products, list):
        products = []
    product_map: dict[int, dict[str, Any]] = {}
    for item in products:
        if not isinstance(item, dict):
            continue
        raw_id = item.get("id")
        try:
            pid = int(raw_id) if raw_id is not None else 0
        except (TypeError, ValueError):
            continue
        if pid <= 0:
            continue
        product_map[pid] = item
    return products, product_map


def _load_orders() -> dict[str, list[dict[str, Any]]]:
    if mysql_available():
        return list_all_orders_mysql()
    raw = read_json("orders.json", default={})
    return raw if isinstance(raw, dict) else {}


def _load_cart() -> dict[str, list[dict[str, Any]]]:
    if mysql_available():
        return list_all_cart_mysql()
    raw = read_json("cart.json", default={})
    return raw if isinstance(raw, dict) else {}


def _load_events() -> dict[str, Any]:
    if mysql_available():
        return load_recommendation_events_mysql()
    raw = read_json("recommendation_events.json", default={"views": {}, "searches": {}})
    if isinstance(raw, dict):
        return raw
    return {"views": {}, "searches": {}}


def _save_events(events: dict[str, Any]) -> None:
    write_json("recommendation_events.json", events)


def _extract_view_weights(events: dict[str, Any], user_id: int) -> dict[int, float]:
    views = events.get("views", {})
    if not isinstance(views, dict):
        return {}
    rows = views.get(str(user_id), [])
    if not isinstance(rows, list):
        return {}

    now = int(time.time())
    weighted: dict[int, float] = {}
    for entry in rows[-200:]:
        if not isinstance(entry, dict):
            continue
        product_id = int(entry.get("product_id", 0))
        if product_id <= 0:
            continue
        ts = int(entry.get("timestamp", now))
        recency_hours = max(1.0, (now - ts) / 3600)
        score = min(3.0, 1.0 + 24.0 / recency_hours)
        weighted[product_id] = weighted.get(product_id, 0.0) + score
    return weighted


def _extract_purchase_weights(orders_store: dict[str, list[dict[str, Any]]], user_id: int) -> dict[int, float]:
    purchases: dict[int, float] = {}
    for order in orders_store.get(str(user_id), []):
        items = order.get("items", [])
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            pid = int(item.get("product_id", 0))
            qty = max(1, int(item.get("quantity", 1)))
            if pid > 0:
                purchases[pid] = purchases.get(pid, 0.0) + qty * 4.0
    return purchases


def _extract_cart_weights(cart_store: dict[str, list[dict[str, Any]]], user_id: int) -> dict[int, float]:
    cart_items = cart_store.get(str(user_id), [])
    if not isinstance(cart_items, list):
        return {}
    scores: dict[int, float] = {}
    for row in cart_items:
        if not isinstance(row, dict):
            continue
        pid = int(row.get("product_id", 0))
        qty = max(1, int(row.get("quantity", 1)))
        if pid > 0:
            scores[pid] = scores.get(pid, 0.0) + qty * 3.0
    return scores


def _combined_user_profile(
    orders_store: dict[str, list[dict[str, Any]]],
    cart_store: dict[str, list[dict[str, Any]]],
    events: dict[str, Any],
    user_id: int,
) -> dict[int, float]:
    combined: dict[int, float] = {}
    sources = (
        _extract_view_weights(events, user_id),
        _extract_purchase_weights(orders_store, user_id),
        _extract_cart_weights(cart_store, user_id),
    )
    for source in sources:
        for pid, score in source.items():
            combined[pid] = combined.get(pid, 0.0) + score
    return combined


def _build_same_style_scores(
    seed_scores: dict[int, float],
    product_map: dict[int, dict[str, Any]],
) -> tuple[dict[int, float], dict[int, list[str]]]:
    output: dict[int, float] = {}
    reasons: dict[int, list[str]] = defaultdict(list)

    for seed_pid, seed_weight in seed_scores.items():
        seed_product = product_map.get(seed_pid)
        if not seed_product:
            continue
        for candidate_id, candidate in product_map.items():
            if candidate_id == seed_pid:
                continue
            delta = 0.0
            if candidate.get("category") == seed_product.get("category"):
                delta += 2.8 * seed_weight
                reasons[candidate_id].append(f"Similar style: {seed_product.get('category')}")
            if candidate.get("material") == seed_product.get("material"):
                delta += 1.9 * seed_weight
                reasons[candidate_id].append(f"Same material: {seed_product.get('material')}")
            if candidate.get("color") == seed_product.get("color"):
                delta += 1.4 * seed_weight
                reasons[candidate_id].append(f"Same color family: {seed_product.get('color')}")
            if delta > 0:
                output[candidate_id] = output.get(candidate_id, 0.0) + delta

    return output, reasons


def _build_bought_together_scores(
    orders_store: dict[str, list[dict[str, Any]]],
    seed_product_ids: set[int],
) -> tuple[dict[int, float], dict[int, list[str]]]:
    output: dict[int, float] = {}
    reasons: dict[int, list[str]] = defaultdict(list)
    for user_orders in orders_store.values():
        if not isinstance(user_orders, list):
            continue
        for order in user_orders:
            items = order.get("items", [])
            if not isinstance(items, list):
                continue
            basket_ids = {int(item.get("product_id", 0)) for item in items if isinstance(item, dict)}
            if not basket_ids.intersection(seed_product_ids):
                continue
            for pid in basket_ids:
                if pid <= 0 or pid in seed_product_ids:
                    continue
                output[pid] = output.get(pid, 0.0) + 3.5
                reasons[pid].append("Users who bought this also bought")
    return output, reasons


def _all_user_vectors(
    orders_store: dict[str, list[dict[str, Any]]],
    cart_store: dict[str, list[dict[str, Any]]],
    events: dict[str, Any],
) -> dict[int, dict[int, float]]:
    user_ids = set()
    user_ids.update(int(uid) for uid in orders_store.keys() if str(uid).isdigit())
    user_ids.update(int(uid) for uid in cart_store.keys() if str(uid).isdigit())
    views = events.get("views", {})
    if isinstance(views, dict):
        user_ids.update(int(uid) for uid in views.keys() if str(uid).isdigit())

    vectors: dict[int, dict[int, float]] = {}
    for uid in user_ids:
        profile = _combined_user_profile(orders_store, cart_store, events, uid)
        if profile:
            vectors[uid] = profile
    return vectors


def _cosine_similarity(a: dict[int, float], b: dict[int, float]) -> float:
    common = set(a.keys()).intersection(b.keys())
    if not common:
        return 0.0
    dot = sum(a[k] * b[k] for k in common)
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _collaborative_scores(
    target_user_id: int,
    target_vector: dict[int, float],
    all_vectors: dict[int, dict[int, float]],
) -> tuple[dict[int, float], dict[int, list[str]]]:
    output: dict[int, float] = {}
    reasons: dict[int, list[str]] = defaultdict(list)
    for uid, vector in all_vectors.items():
        if uid == target_user_id:
            continue
        similarity = _cosine_similarity(target_vector, vector)
        if similarity < 0.08:
            continue
        for pid, weight in vector.items():
            if pid in target_vector:
                continue
            boost = similarity * weight
            output[pid] = output.get(pid, 0.0) + boost
            reasons[pid].append(f"Similar users affinity ({similarity:.2f})")
    return output, reasons


def _safe_import_tensorflow() -> Any | None:
    try:
        import importlib

        tf = importlib.import_module("tensorflow")
        return tf
    except Exception:
        return None


def _safe_import_sklearn():
    try:
        import importlib

        pd = importlib.import_module("pandas")
        tfidf_module = importlib.import_module("sklearn.feature_extraction.text")
        metrics_module = importlib.import_module("sklearn.metrics.pairwise")

        TfidfVectorizer = getattr(tfidf_module, "TfidfVectorizer")
        cosine_similarity = getattr(metrics_module, "cosine_similarity")
        return pd, TfidfVectorizer, cosine_similarity
    except Exception:
        return None


def _build_product_text(item: dict[str, Any]) -> str:
    parts = [
        str(item.get("name", "")),
        str(item.get("category", "")),
        str(item.get("material", "")),
        str(item.get("color", "")),
        str(item.get("description", "")),
    ]
    return " ".join(part for part in parts if part)


def _ml_tfidf_scores(
    user_profile: dict[int, float],
    products: list[dict[str, Any]],
    product_map: dict[int, dict[str, Any]],
) -> tuple[dict[int, float], dict[int, list[str]]]:
    safe = _safe_import_sklearn()
    if safe is None:
        return {}, {}
    pd, TfidfVectorizer, cosine_similarity = safe

    product_ids: list[int] = []
    for item in products:
        if not isinstance(item, dict):
            continue
        raw_id = item.get("id")
        try:
            pid = int(raw_id) if raw_id is not None else 0
        except (TypeError, ValueError):
            continue
        if pid <= 0:
            continue
        product_ids.append(pid)
    if not product_ids:
        return {}, {}

    rows = []
    for pid in product_ids:
        product = product_map.get(pid)
        if not product:
            continue
        rows.append({"id": pid, "text": _build_product_text(product)})

    if not rows:
        return {}, {}

    df = pd.DataFrame(rows)
    vectorizer = TfidfVectorizer(stop_words="english", max_features=2000)
    tfidf = vectorizer.fit_transform(df["text"].tolist())

    # Build user profile text from interacted products.
    interacted_ids = [pid for pid in user_profile.keys() if pid in product_map]
    if not interacted_ids:
        return {}, {}
    user_text = " ".join(_build_product_text(product_map[pid]) for pid in interacted_ids)
    if not user_text.strip():
        return {}, {}

    user_vec = vectorizer.transform([user_text])
    sims = cosine_similarity(user_vec, tfidf).flatten()

    output: dict[int, float] = {}
    reasons: dict[int, list[str]] = defaultdict(list)
    for idx, pid in enumerate(df["id"].tolist()):
        if pid in user_profile:
            continue
        score = float(sims[idx]) * 10.0
        if score <= 0:
            continue
        output[pid] = output.get(pid, 0.0) + score
        reasons[pid].append("ML text similarity match to your interests")

    return output, reasons


def _advanced_ml_scores(
    tf: Any,
    user_profile: dict[int, float],
    products: list[dict[str, Any]],
    product_map: dict[int, dict[str, Any]],
) -> tuple[dict[int, float], dict[int, list[str]]]:
    # Build compact product feature vectors.
    categories = sorted({str(item.get("category", "")) for item in products})
    materials = sorted({str(item.get("material", "")) for item in products})
    colors = sorted({str(item.get("color", "")) for item in products})

    cat_index = {value: idx for idx, value in enumerate(categories)}
    mat_index = {value: idx for idx, value in enumerate(materials)}
    col_index = {value: idx for idx, value in enumerate(colors)}

    def encode_product(item: dict[str, Any]) -> list[float]:
        feature_len = len(cat_index) + len(mat_index) + len(col_index) + 2
        vec = [0.0] * feature_len
        offset = 0
        vec[offset + cat_index.get(str(item.get("category", "")), 0)] = 1.0
        offset += len(cat_index)
        vec[offset + mat_index.get(str(item.get("material", "")), 0)] = 1.0
        offset += len(mat_index)
        vec[offset + col_index.get(str(item.get("color", "")), 0)] = 1.0
        offset += len(col_index)
        vec[offset] = float(item.get("price", 0) or 0) / 4000.0
        vec[offset + 1] = float(item.get("rating", 0) or 0) / 5.0
        return vec

    product_ids: list[int] = []
    for item in products:
        if not isinstance(item, dict):
            continue
        raw_id = item.get("id")
        try:
            pid = int(raw_id) if raw_id is not None else 0
        except (TypeError, ValueError):
            continue
        if pid <= 0:
            continue
        product_ids.append(pid)

    x = [encode_product(product_map[pid]) for pid in product_ids if pid in product_map]
    y = [1.0 if pid in user_profile else 0.0 for pid in product_ids if pid in product_map]
    if not x:
        return {}, {}

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(len(x[0]),)),
            tf.keras.layers.Dense(24, activation="relu"),
            tf.keras.layers.Dense(12, activation="relu"),
            tf.keras.layers.Dense(1, activation="sigmoid"),
        ]
    )
    model.compile(optimizer="adam", loss="binary_crossentropy")
    model.fit(x, y, epochs=8, verbose=0)
    predictions = model.predict(x, verbose=0).flatten().tolist()

    output: dict[int, float] = {}
    reasons: dict[int, list[str]] = defaultdict(list)
    for pid, raw_score in zip(product_ids, predictions):
        if pid in user_profile:
            continue
        score = float(raw_score) * 8.0
        output[pid] = output.get(pid, 0.0) + score
        reasons[pid].append("ML ranker predicted high fit for your profile")
    return output, reasons


def _merge_scores(
    target_scores: list[tuple[dict[int, float], dict[int, list[str]]]],
    interacted_ids: set[int],
    product_map: dict[int, dict[str, Any]],
) -> list[dict[str, Any]]:
    combined: dict[int, float] = {}
    reason_map: dict[int, list[str]] = defaultdict(list)

    for scores, reasons in target_scores:
        for pid, score in scores.items():
            if pid in interacted_ids or pid not in product_map:
                continue
            combined[pid] = combined.get(pid, 0.0) + score
            reason_map[pid].extend(reasons.get(pid, []))

    ranked = sorted(
        combined.items(),
        key=lambda row: (
            row[1],
            float(product_map[row[0]].get("rating", 0) or 0),
            int(product_map[row[0]].get("reviews", 0) or 0),
        ),
        reverse=True,
    )
    output = []
    for pid, score in ranked:
        product = dict(product_map[pid])
        unique_reasons = []
        for reason in reason_map[pid]:
            if reason not in unique_reasons:
                unique_reasons.append(reason)
            if len(unique_reasons) >= 3:
                break
        product["recommendation_score"] = round(score, 3)
        product["recommendation_reasons"] = unique_reasons or ["Personalized for your shopping profile"]
        output.append(product)
    return output


@router.post("/track-search")
def track_search_event(
    payload: dict[str, str],
    authorization: str | None = Header(default=None),
) -> dict[str, bool]:
    user = get_user_from_authorization(authorization)
    query = str(payload.get("query", "")).strip()
    if not query:
        return {"success": True}

    if mysql_available():
        record_search_event_mysql(int(user["id"]), query, int(time.time()))
        return {"success": True}

    events = _load_events()
    searches = events.get("searches", {})
    if not isinstance(searches, dict):
        searches = {}
    key = str(user["id"])
    rows = searches.get(key, [])
    if not isinstance(rows, list):
        rows = []
    rows.append({"query": query, "timestamp": int(time.time())})
    searches[key] = rows[-120:]
    events["searches"] = searches
    _save_events(events)
    return {"success": True}


@router.get("/style-quiz/me")
def get_style_quiz_profile(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = get_user_from_authorization(authorization)
    profile = _get_style_profile(int(user["id"]))
    return {"exists": bool(profile), "profile": profile}


@router.post("/style-quiz")
def save_style_quiz_profile(payload: StyleQuizPayload, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = get_user_from_authorization(authorization)
    user_id = int(user["id"])

    sanitized_profile = {
        "preferred_categories": _sanitize_tokens(payload.preferred_categories),
        "preferred_colors": _sanitize_tokens(payload.preferred_colors),
        "preferred_materials": _sanitize_tokens(payload.preferred_materials),
        "budget_max": int(payload.budget_max) if isinstance(payload.budget_max, int) else None,
        "occasions": _sanitize_tokens(payload.occasions),
        "updated_at": int(time.time()),
    }
    if mysql_available():
        saved = save_style_quiz_profile_mysql(user_id, sanitized_profile)
        return {"success": True, "profile": saved or sanitized_profile}

    store = _load_style_profiles()
    store[str(user_id)] = sanitized_profile
    _save_style_profiles(store)
    return {"success": True, "profile": sanitized_profile}


@router.get("/personalized")
def get_personalized_recommendations(
    level: str = Query(default="basic", pattern="^(basic|intermediate|advanced)$"),
    limit: int = Query(default=12, ge=1, le=36),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    user = get_user_from_authorization(authorization)
    user_id = int(user["id"])

    products, product_map = _load_products()
    orders_store = _load_orders()
    cart_store = _load_cart()
    events = _load_events()
    style_profile = _get_style_profile(user_id)

    target_profile = _combined_user_profile(orders_store, cart_store, events, user_id)
    style_scores, style_reasons = _quiz_profile_scores(style_profile, products, product_map)

    if not target_profile:
        if style_scores:
            ranked = _merge_scores([(style_scores, style_reasons)], set(), product_map)
            return {
                "level": level,
                "count": min(limit, len(ranked)),
                "cold_start": False,
                "explanations": ["Using your style quiz preferences"],
                "results": ranked[:limit],
            }
        # Cold start: top-rated/popular products
        cold = sorted(
            products,
            key=lambda p: (float(p.get("rating", 0) or 0), int(p.get("reviews", 0) or 0)),
            reverse=True,
        )
        return {
            "level": level,
            "count": min(limit, len(cold)),
            "cold_start": True,
            "explanations": ["No user history yet, showing top-rated products"],
            "results": cold[:limit],
        }

    interacted_ids = set(target_profile.keys())
    basic_style_scores, basic_style_reasons = _build_same_style_scores(target_profile, product_map)
    basket_scores, basket_reasons = _build_bought_together_scores(orders_store, interacted_ids)

    scoring_blocks: list[tuple[dict[int, float], dict[int, list[str]]]] = [
        (basic_style_scores, basic_style_reasons),
        (basket_scores, basket_reasons),
    ]
    explanations = [
        "Uses browsing history, purchase history, cart activity, and bought-together patterns",
    ]

    if style_scores:
        scoring_blocks.append((style_scores, style_reasons))
        explanations.append("Enhanced with your style quiz preferences")

    if level in {"intermediate", "advanced"}:
        all_vectors = _all_user_vectors(orders_store, cart_store, events)
        collab_scores, collab_reasons = _collaborative_scores(user_id, target_profile, all_vectors)
        scoring_blocks.append((collab_scores, collab_reasons))
        explanations.append("Collaborative filtering based on similar users")

    if level == "advanced":
        tfidf_scores, tfidf_reasons = _ml_tfidf_scores(target_profile, products, product_map)
        if tfidf_scores:
            scoring_blocks.append((tfidf_scores, tfidf_reasons))
            explanations.append("Scikit-learn TF-IDF similarity model applied")
        else:
            tf = _safe_import_tensorflow()
            if tf is not None:
                ml_scores, ml_reasons = _advanced_ml_scores(tf, target_profile, products, product_map)
                scoring_blocks.append((ml_scores, ml_reasons))
                explanations.append("TensorFlow model ranker applied")
            else:
                explanations.append("ML libraries not installed, fallback to intermediate strategy")

    ranked = _merge_scores(scoring_blocks, interacted_ids, product_map)

    # "Matching dupattas" approximation: recommend same color across different style categories.
    if ranked and len(ranked) < limit:
        seed_ids = list(interacted_ids)[:4]
        seed_colors = {
            str(product_map[pid].get("color"))
            for pid in seed_ids
            if pid in product_map and product_map[pid].get("color")
        }
        dupatta_like = [
            dict(item)
            for item in products
            if str(item.get("color")) in seed_colors and int(item.get("id", 0)) not in interacted_ids
        ]
        dupatta_like.sort(key=lambda p: float(p.get("rating", 0) or 0), reverse=True)
        for item in dupatta_like:
            item["recommendation_score"] = 0.5
            item["recommendation_reasons"] = ["Matching color family suggestions"]
            ranked.append(item)
            if len(ranked) >= limit:
                break

    return {
        "level": level,
        "count": min(limit, len(ranked)),
        "cold_start": False,
        "explanations": explanations,
        "results": ranked[:limit],
    }

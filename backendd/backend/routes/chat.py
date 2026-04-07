from __future__ import annotations

import json
import os
import re
from typing import Any
from urllib import error, request

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

try:
    from ..database import read_json
    from ..mysql_db import list_bottomwear_mysql, list_dupatta_mysql, list_products_mysql, mysql_available
    from .products import _build_all_dynamic_section_products
except ImportError:
    from database import read_json
    from mysql_db import list_bottomwear_mysql, list_dupatta_mysql, list_products_mysql, mysql_available
    from routes.products import _build_all_dynamic_section_products

router = APIRouter(prefix="/chat", tags=["chat"])

OPENAI_URL = "https://api.openai.com/v1/responses"
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
SPACY_MODEL = os.getenv("SPACY_MODEL", "en_core_web_sm")

COLOR_WORDS = [
    "Blue",
    "Green",
    "Maroon",
    "Peach",
    "Pink",
    "Teal",
    "White",
    "Yellow",
    "Black",
    "Purple",
    "Orange",
]

SIZE_MAP: dict[str, str] = {
    "xs": "XS",
    "extra small": "XS",
    "s": "S",
    "small": "S",
    "m": "M",
    "medium": "M",
    "l": "L",
    "large": "L",
    "xl": "XL",
    "extra large": "XL",
    "xxl": "XXL",
    "double xl": "XXL",
}

VARIETY_MAP: dict[str, dict[str, str]] = {
    "office wear": {"category": "Formal"},
    "cotton": {"material": "Cotton"},
    "chikankari": {"category": "Chikankari"},
    "festive wear": {"category": "Anarkali"},
    "casual": {"category": "Casual"},
    "anarkali": {"category": "Anarkali"},
    "silk": {"category": "Silk"},
}

OCCASION_MAP: dict[str, dict[str, str]] = {
    "office": {"category": "Formal"},
    "office wear": {"category": "Formal"},
    "casual": {"category": "Casual"},
    "festive": {"category": "Anarkali"},
    "party": {"category": "Anarkali"},
}

CATEGORY_TYPE_ALIASES = {
    "kurti": "kurti",
    "kurtis": "kurti",
    "bottomwear": "bottomwear",
    "bottom wear": "bottomwear",
    "pants": "bottomwear",
    "palazzo": "bottomwear",
    "leggins": "bottomwear",
    "leggings": "bottomwear",
    "dupatta": "dupatta",
}

_SPACY_NLP: Any | None = None
_SPACY_ERROR: str | None = None


def _get_spacy_nlp() -> Any | None:
    global _SPACY_NLP, _SPACY_ERROR
    if _SPACY_NLP is not None or _SPACY_ERROR:
        return _SPACY_NLP
    try:
        import spacy  # type: ignore

        _SPACY_NLP = spacy.load(SPACY_MODEL)
    except Exception as exc:
        _SPACY_ERROR = str(exc)
        _SPACY_NLP = None
    return _SPACY_NLP


def _extract_spacy_filters(message: str) -> dict[str, Any]:
    nlp = _get_spacy_nlp()
    if nlp is None:
        return {}

    extracted: dict[str, Any] = {}
    doc = nlp(message)
    text_lower = " ".join(token.text.lower() for token in doc)

    # Colors (token-based)
    for token in doc:
        token_text = token.text.lower()
        if token_text in {color.lower() for color in COLOR_WORDS}:
            extracted["color"] = token.text.capitalize()
            break

    # Sizes (phrase + token)
    for size_phrase, normalized in SIZE_MAP.items():
        if size_phrase in text_lower:
            extracted["size"] = normalized
            break

    # Variety / occasion (phrase)
    for variety in VARIETY_MAP:
        if variety in text_lower:
            extracted["variety"] = variety
            break
    for occasion in OCCASION_MAP:
        if occasion in text_lower:
            extracted["occasion"] = occasion
            break

    # Budget using money/number entities
    for ent in doc.ents:
        if ent.label_ in {"MONEY", "CARDINAL"}:
            digits = re.sub(r"[^\d]", "", ent.text)
            if digits:
                extracted["budget"] = min(4000, int(digits))
                break

    return extracted


class ChatAssistantPayload(BaseModel):
    message: str = Field(min_length=1, max_length=600)
    context: dict[str, Any] = Field(default_factory=dict)


def _extract_rule_filters(message: str) -> dict[str, Any]:
    text = message.strip().lower()
    extracted: dict[str, Any] = {}

    for color in COLOR_WORDS:
        if re.search(rf"\b{re.escape(color.lower())}\b", text):
            extracted["color"] = color
            break

    for token, normalized in SIZE_MAP.items():
        if re.search(rf"\b{re.escape(token)}\b", text):
            extracted["size"] = normalized
            break

    for variety in VARIETY_MAP:
        if re.search(rf"\b{re.escape(variety)}\b", text):
            extracted["variety"] = variety
            break

    for occasion in OCCASION_MAP:
        if re.search(rf"\b{re.escape(occasion)}\b", text):
            extracted["occasion"] = occasion
            break

    budget_match = re.search(r"\b(?:under|upto|up to|below)\s+(\d{2,6})\b", text)
    if budget_match:
        extracted["budget"] = min(4000, int(budget_match.group(1)))
    else:
        loose_budget = re.search(r"\b(\d{2,6})\b", text)
        if loose_budget:
            extracted["budget"] = min(4000, int(loose_budget.group(1)))

    # SpaCy enhancement (fills missing fields)
    spacy_filters = _extract_spacy_filters(message)
    for key, value in spacy_filters.items():
        if key not in extracted and value:
            extracted[key] = value

    if "category_type" not in extracted:
        inferred_category = _infer_category_type(message)
        if inferred_category:
            extracted["category_type"] = inferred_category

    return extracted


def _extract_openai_text(body: dict[str, Any]) -> str | None:
    if isinstance(body.get("output_text"), str):
        return body.get("output_text")

    output = body.get("output")
    if not isinstance(output, list):
        return None

    chunks: list[str] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if not isinstance(content, list):
            continue
        for part in content:
            if isinstance(part, dict) and part.get("type") == "output_text":
                text = part.get("text")
                if isinstance(text, str):
                    chunks.append(text)
    return "".join(chunks).strip() if chunks else None


def _call_openai(message: str, context: dict[str, Any]) -> dict[str, Any] | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    system_prompt = (
        "You are a shopping assistant for women's kurtis, bottomwear, and dupattas. "
        "Respond in concise professional tone. "
        "Return strict JSON with keys: reply, filters, ask_next. "
        "filters can include category_type (kurti|bottomwear|dupatta), color, size, variety, occasion, budget. "
        "ask_next must be one of: none,category_type,size,color,variety,occasion,budget. "
        "If category_type is missing, ask for it first."
        "JSON output only."
    )
    payload = {
        "model": OPENAI_MODEL,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "input": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Current context: {json.dumps(context)}\nUser message: {message}"},
        ],
    }

    req = request.Request(
        OPENAI_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError):
        return None

    try:
        content = _extract_openai_text(body)
        if not content:
            return None
        parsed = json.loads(content)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        return None
    return None


def _all_products() -> list[dict[str, Any]]:
    if mysql_available():
        base = list_products_mysql()
    else:
        base = read_json("products.json", default=[])
    if not isinstance(base, list):
        base = []
    dynamic = _build_all_dynamic_section_products(base)
    return [*base, *dynamic]


def _all_bottomwear() -> list[dict[str, Any]]:
    if mysql_available():
        bottomwear = list_bottomwear_mysql()
    else:
        bottomwear = read_json("bottomwear_products.json", default=[])
    return bottomwear if isinstance(bottomwear, list) else []


def _all_dupatta() -> list[dict[str, Any]]:
    if mysql_available():
        dupatta = list_dupatta_mysql()
    else:
        dupatta = read_json("dupatta_products.json", default=[])
    return dupatta if isinstance(dupatta, list) else []


def _infer_category_type(message: str) -> str | None:
    lowered = message.strip().lower()
    for key, value in CATEGORY_TYPE_ALIASES.items():
        if key in lowered:
            return value
    return None

def _normalize(value: Any) -> str:
    return str(value or "").strip().lower()


def _text_matches(value: Any, target: str) -> bool:
    if not target:
        return True
    source = _normalize(value)
    if not source:
        return False
    if source == target:
        return True
    if target in source or source in target:
        return True
    return False


def _apply_filters(products: list[dict[str, Any]], filters: dict[str, Any]) -> list[dict[str, Any]]:
    result = products
    color = _normalize(filters.get("color", ""))
    size = str(filters.get("size", "")).strip().upper()
    variety = _normalize(filters.get("variety", ""))
    occasion = _normalize(filters.get("occasion", ""))
    budget = filters.get("budget")

    if color:
        result = [item for item in result if _text_matches(item.get("color", ""), color)]
    if size:
        result = [item for item in result if size in [str(s).upper() for s in item.get("sizes", [])]]
    if variety in VARIETY_MAP:
        variety_rules = VARIETY_MAP[variety]
        category = variety_rules.get("category")
        material = variety_rules.get("material")
        if category:
            result = [item for item in result if _text_matches(item.get("category", ""), _normalize(category))]
        if material:
            result = [item for item in result if _text_matches(item.get("material", ""), _normalize(material))]
    if occasion in OCCASION_MAP:
        occasion_rules = OCCASION_MAP[occasion]
        category = occasion_rules.get("category")
        material = occasion_rules.get("material")
        if category:
            result = [item for item in result if _text_matches(item.get("category", ""), _normalize(category))]
        if material:
            result = [item for item in result if _text_matches(item.get("material", ""), _normalize(material))]
    if isinstance(budget, (int, float)):
        result = [item for item in result if float(item.get("price", 0) or 0) <= float(budget)]
    return result


def _relax_filters(products: list[dict[str, Any]], filters: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    # Relax order: budget -> size -> color -> occasion -> variety
    relax_order = ["budget", "size", "color", "occasion", "variety"]
    current_filters = dict(filters)
    filtered = _apply_filters(products, current_filters)
    if filtered:
        return filtered, current_filters
    for key in relax_order:
        if key in current_filters:
            current_filters.pop(key, None)
            filtered = _apply_filters(products, current_filters)
            if filtered:
                return filtered, current_filters
    return [], current_filters


def _recommendation_links(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ranked = sorted(
        products,
        key=lambda item: (
            float(item.get("rating", 0) or 0),
            int(item.get("reviews", 0) or 0),
        ),
        reverse=True,
    )
    return [
        {
            "id": int(item.get("id", 0)),
            "name": str(item.get("name", "")),
            "color": str(item.get("color", "")),
            "price": float(item.get("price", 0) or 0),
            "category": str(item.get("category", "")),
            "image_url": str(item.get("image_url", "")),
        }
        for item in ranked[:6]
        if int(item.get("id", 0)) > 0
    ]


def _attach_absolute_image_url(item: dict[str, Any], request: Request) -> dict[str, Any]:
    image_url = item.get("image_url")
    if isinstance(image_url, str) and image_url.startswith("/"):
        absolute = str(request.base_url).rstrip("/") + image_url
        return {**item, "image_url": absolute}
    return item


@router.post("/assistant")
def chat_assistant(payload: ChatAssistantPayload, request: Request):
    message = payload.message.strip()
    context = payload.context if isinstance(payload.context, dict) else {}
    previous_filters = context.get("filters", {}) if isinstance(context.get("filters"), dict) else {}
    filters = dict(previous_filters)

    ai_data = _call_openai(message, context)
    if ai_data and isinstance(ai_data.get("filters"), dict):
        filters.update(ai_data.get("filters", {}))

    rule_filters = _extract_rule_filters(message)
    filters.update(rule_filters)

    category_type = str(filters.get("category_type", "") or "").strip().lower()
    if not category_type:
        inferred = _infer_category_type(message)
        if inferred:
            category_type = inferred
            filters["category_type"] = inferred

    if "budget" in filters:
        try:
            filters["budget"] = min(4000, int(float(filters["budget"])))
        except Exception:
            filters.pop("budget", None)

    if category_type == "bottomwear":
        products = _all_bottomwear()
    elif category_type == "dupatta":
        products = _all_dupatta()
    else:
        products = _all_products()
    filtered = _apply_filters(products, filters)

    reply = str(ai_data.get("reply", "")) if isinstance(ai_data, dict) else ""
    ask_next = str(ai_data.get("ask_next", "none")) if isinstance(ai_data, dict) else "none"

    if not category_type:
        ask_next = "category_type"
    else:
        required_order = ["color", "variety", "occasion", "size"]
        missing = [key for key in required_order if not str(filters.get(key, "")).strip()]
        ask_next = missing[0] if missing else "none"

    links: list[dict[str, Any]] = []
    if not filtered:
        filtered, relaxed_filters = _relax_filters(products, filters)
        if filtered:
            filters = relaxed_filters
            links = [_attach_absolute_image_url(item, request) for item in _recommendation_links(filtered)]
            if not reply:
                reply = "I found close matches based on what you shared. You can refine if needed."
            ask_next = "none" if links else ask_next
        else:
            if ask_next == "none":
                ask_next = "color"
            if ask_next == "category_type":
                reply = "What are you looking for: kurti, bottomwear, or dupatta?"
            elif ask_next == "color":
                reply = "Which color do you prefer?"
            elif ask_next == "variety":
                reply = "Which variety do you prefer: office wear, cotton, chikankari, festive wear, casual?"
            elif ask_next == "occasion":
                reply = "What occasion are you shopping for? (casual, office wear, festive, party)"
            elif ask_next == "size":
                reply = "Please share your preferred size (XS, S, M, L, XL, XXL)."
    else:
        if ask_next == "none":
            links = [_attach_absolute_image_url(item, request) for item in _recommendation_links(filtered)]
            if links and not reply:
                reply = "I found matching options. Click any product below to open details."
        else:
            if ask_next == "category_type":
                reply = "What are you looking for: kurti, bottomwear, or dupatta?"
            elif ask_next == "color":
                reply = "Which color do you prefer?"
            elif ask_next == "variety":
                reply = "Which variety do you prefer: office wear, cotton, chikankari, festive wear, casual?"
            elif ask_next == "occasion":
                reply = "What occasion are you shopping for? (casual, office wear, festive, party)"
            elif ask_next == "size":
                reply = "Please share your preferred size (XS, S, M, L, XL, XXL)."

    if re.search(r"\b(hi|hello|hey)\b", message.lower()) and len(message.split()) <= 3:
        reply = "Hi! Let’s personalize. Which color do you prefer?"
        ask_next = "color"
        links = []
        filters = {}

    return {
        "reply": reply,
        "context": {"filters": filters, "ask_next": ask_next},
        "links": links,
        "model_used": bool(os.getenv("OPENAI_API_KEY")),
    }

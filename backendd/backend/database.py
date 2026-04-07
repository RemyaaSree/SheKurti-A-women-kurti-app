from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.parse import quote

DATA_DIR = Path(__file__).resolve().parent / "data"

DEFAULT_BLOG = [
    {
        "id": 1,
        "title": "How to Style Kurtis for Office Wear",
        "excerpt": "Simple styling ideas to make kurtis work-ready.",
        "category": "Style",
        "date": "2026-01-05",
    },
    {
        "id": 2,
        "title": "Top Festive Kurti Colors This Season",
        "excerpt": "A quick guide to trending festive palettes.",
        "category": "Trends",
        "date": "2026-01-12",
    },
]

DEFAULT_FAQS = [
    {
        "id": 1,
        "question": "What is your return policy?",
        "answer": "Returns are accepted within 7 days from delivery for unused items.",
    },
    {
        "id": 2,
        "question": "Do you provide Cash on Delivery?",
        "answer": "Yes, COD is available for selected pincodes.",
    },
]


def _generate_default_products() -> list[dict[str, Any]]:
    categories = [
        {"name": "Anarkali", "material": "Silk"},
        {"name": "Casual", "material": "Cotton"},
        {"name": "Chikankari", "material": "Cotton"},
        {"name": "Formal", "material": "Rayon"},
        {"name": "Short", "material": "Georgette"},
        {"name": "Silk", "material": "Pure Silk"},
    ]
    colors = ["Blue", "Green", "Maroon", "Peach", "Pink", "Teal", "White", "Yellow"]
    sizes = ["XS", "S", "M", "L", "XL", "XXL"]
    # Pricing strategy:
    # - Cotton collections remain budget-friendly
    # - Premium/grand styles are placed around 3.3k-4k
    price_map: dict[str, list[int]] = {
        "Casual": [499, 549, 599, 649, 699, 749, 799, 899],
        "Chikankari": [899, 999, 1099, 1199, 1299, 1399, 1499, 1599],
        "Short": [449, 499, 549, 599, 649, 699, 749, 799],
        "Formal": [2190, 2390, 2590, 2790, 2990, 3190, 3390, 3490],
        "Anarkali": [3190, 3290, 3390, 3490, 3590, 3290, 3450, 3520],
        "Silk": [3290, 3390, 3490, 3590, 3690, 3790, 3890, 3990],
    }

    products: list[dict[str, Any]] = []
    product_id = 1

    for category in categories:
        for color_index, color in enumerate(colors):
            price = price_map[category["name"]][color_index]
            original_price = min(4000, int(round(price * 1.22 / 10) * 10))
            if original_price <= price:
                original_price = min(4000, price + 100)
            products.append(
                {
                    "id": product_id,
                    "name": f"{category['name']} {color} Kurti",
                    "price": price,
                    "original_price": original_price,
                    "image_url": f"/assets/{category['name'].lower()}/{quote(category['name'] + ' ' + color + '.png')}",
                    "category": category["name"],
                    "color": color,
                    "material": category["material"],
                    "sizes": sizes,
                    "rating": 4.6,
                    "reviews": 150 + (product_id * 7) % 250,
                    "description": f"Premium {color.lower()} {category['name'].lower()} kurti for modern ethnic styling.",
                }
            )
            product_id += 1

    return products


DEFAULT_FILES: dict[str, Any] = {
    "products.json": _generate_default_products(),
    "cart.json": {},
    "orders.json": {},
    "recommendation_events.json": {"views": {}, "searches": {}},
    "style_quiz_profiles.json": {},
    "addresses.json": {},
    "blog.json": DEFAULT_BLOG,
    "faqs.json": DEFAULT_FAQS,
    "contact_messages.json": [],
    "users.json": [],
}


def ensure_data_files() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def read_json(file_name: str, default: Any) -> Any:
    file_path = DATA_DIR / file_name
    if not file_path.exists():
        return default

    with file_path.open("r", encoding="utf-8") as file:
        try:
            return json.load(file)
        except json.JSONDecodeError:
            return default


def write_json(file_name: str, data: Any) -> None:
    file_path = DATA_DIR / file_name
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with file_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)

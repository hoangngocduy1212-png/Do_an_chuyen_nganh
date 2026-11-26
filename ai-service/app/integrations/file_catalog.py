"""Đọc catalog từ file JSON xuất MongoDB khi chưa có endpoint /internal/products của NestJS.

Chỉ trả name/price/unit/image/category; KHÔNG có tồn kho.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

from app.core.config import settings

_cache: dict = {"mtime": None, "by_id": {}}


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", (text or "").lower().replace("đ", "d"))
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def _load() -> dict[str, dict]:
    path = Path(settings.products_file)
    mtime = path.stat().st_mtime if path.exists() else None
    if _cache["by_id"] and _cache["mtime"] == mtime:
        return _cache["by_id"]
    rows = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    by_id: dict[str, dict] = {}
    for row in rows:
        if row.get("status", "ACTIVE") != "ACTIVE":
            continue
        pid = str(row.get("productId") or row.get("product_id") or "")
        name = row.get("productName") or row.get("name") or ""
        if not pid or not name:
            continue
        price = row.get("price")
        unit = row.get("unit") or ""
        try:
            price_text = f"{int(price):,}".replace(",", ".") + "đ" + (f"/{unit}" if unit else "")
        except (TypeError, ValueError):
            price_text = ""
        by_id[pid] = {
            "id": pid,
            "name": name,
            "price": price,
            "price_text": price_text,
            "unit": unit,
            "image": row.get("image") or "",
            "categoryId": row.get("categoryId") or row.get("category_id") or "",
            # Không đưa tồn kho vào đây: file không có dữ liệu tồn kho.
        }
    _cache.update(mtime=mtime, by_id=by_id)
    return by_id


def get_products(ids: list[str]) -> list[dict]:
    by_id = _load()
    return [by_id[pid] for pid in ids if pid in by_id]


def search(query: str, limit: int = 5) -> list[dict]:
    """Fallback tìm theo từ khóa nếu Qdrant/embedding tạm lỗi."""
    tokens = [t for t in re.findall(r"[a-z0-9]+", _norm(query)) if len(t) > 1]
    if not tokens:
        return []
    scored = []
    for product in _load().values():
        words = set(re.findall(r"[a-z0-9]+", _norm(product["name"])))
        score = sum(1 for token in tokens if token in words) / len(tokens)
        if score >= 0.6:
            scored.append((score, product))
    scored.sort(key=lambda item: -item[0])
    return [product for _, product in scored[:limit]]

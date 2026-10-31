import math
import re
import time
import unicodedata
from collections import Counter

from app.db.mongo import get_db

_CACHE_TTL = 300
_cache: dict = {"at": 0.0, "docs": []}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.replace("đ", "d").replace("Đ", "D").lower()


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", normalize(text))
    return words + [f"{a} {b}" for a, b in zip(words, words[1:])]


def _load() -> list[dict]:
    if time.time() - _cache["at"] < _CACHE_TTL and _cache["docs"]:
        return _cache["docs"]
    db = get_db()
    categories = {c["categoryId"]: c.get("categoryName", "") for c in db["categories"].find({}, {"categoryId": 1, "categoryName": 1})}
    docs = []
    for p in db["products"].find({"status": "ACTIVE"}):
        text = f"{p.get('productName', '')} {p.get('productName', '')} {categories.get(p.get('categoryId'), '')} {p.get('description', '')}"
        docs.append({
            "productId": p["productId"],
            "name": p.get("productName", ""),
            "price": p.get("price", 0),
            "soldCount": p.get("soldCount", 0),
            "tokens": Counter(tokenize(text)),
        })
    df = Counter(t for d in docs for t in d["tokens"])
    n = max(len(docs), 1)
    idf = {t: math.log((1 + n) / (1 + c)) + 1 for t, c in df.items()}
    for d in docs:
        vec = {t: tf * idf[t] for t, tf in d["tokens"].items()}
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        d["vec"] = {t: v / norm for t, v in vec.items()}
    _cache.update(at=time.time(), docs=docs, idf=idf)
    return docs


def _in_stock(store_id: str | None) -> set[str] | None:
    if not store_id:
        return None
    rows = get_db()["inventories"].find({"storeId": store_id}, {"productId": 1, "quantity": 1, "reservedQuantity": 1})
    return {r["productId"] for r in rows if r.get("quantity", 0) - r.get("reservedQuantity", 0) > 0}


def _cosine(a: dict, b: dict) -> float:
    if len(a) > len(b):
        a, b = b, a
    return sum(v * b.get(t, 0.0) for t, v in a.items())


def _rank(query_vec: dict, store_id: str | None, limit: int, exclude: str | None = None, min_score: float = 0.0):
    docs = _load()
    stock = _in_stock(store_id)
    scored = []
    for d in docs:
        if d["productId"] == exclude or (stock is not None and d["productId"] not in stock):
            continue
        s = _cosine(query_vec, d["vec"])
        if s > min_score:
            scored.append((d, s))
    scored.sort(key=lambda x: x[1], reverse=True)
    return [{"productId": d["productId"], "name": d["name"], "price": d["price"], "score": round(s, 4)} for d, s in scored[:limit]]


def search(query: str, store_id: str | None, limit: int = 5) -> list[dict]:
    docs = _load()
    idf = _cache.get("idf", {})
    counts = Counter(t for t in tokenize(query) if t in idf)
    vec = {t: c * idf[t] for t, c in counts.items()}
    norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
    return _rank({t: v / norm for t, v in vec.items()}, store_id, limit, min_score=0.05) if docs else []


def similar(product_id: str, store_id: str | None, limit: int = 8) -> list[dict]:
    base = next((d for d in _load() if d["productId"] == product_id), None)
    return _rank(base["vec"], store_id, limit, exclude=product_id) if base else []


def best_sellers(store_id: str | None, limit: int = 8) -> list[dict]:
    stock = _in_stock(store_id)
    docs = [d for d in _load() if stock is None or d["productId"] in stock]
    docs.sort(key=lambda d: d["soldCount"], reverse=True)
    return [{"productId": d["productId"], "name": d["name"], "price": d["price"], "score": float(d["soldCount"])} for d in docs[:limit]]

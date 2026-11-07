import math
import re
import time
import unicodedata
from collections import Counter

from app.db.mongo import get_db

_CACHE_TTL = 300
_cache: dict = {"at": 0.0, "docs": []}
_stock_cache: dict[str, tuple[float, set[str]]] = {}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.replace("đ", "d").replace("Đ", "D").lower()


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", normalize(text))
    return words + [f"{a} {b}" for a, b in zip(words, words[1:])]


QUERY_STOPWORDS = {
    "ban", "co", "khong", "toi", "minh", "muon", "mua", "can", "tim", "cho", "xin", "oi", "nhe", "nha", "a",
    "la", "cua", "va", "voi", "o", "dau", "nao", "gi", "bao", "nhieu", "duoc", "hay", "di", "the", "nay",
    "shop", "cua hang", "sieu thi", "ben",
}


def query_tokens(text: str) -> list[str]:
    """Like tokenize() but drops conversational filler so 'ban co ... khong' cannot match product names."""
    words = [w for w in re.findall(r"[a-z0-9]+", normalize(text)) if w not in QUERY_STOPWORDS]
    return words + [f"{a} {b}" for a, b in zip(words, words[1:])]


def _load() -> list[dict]:
    if time.time() - _cache["at"] < _CACHE_TTL and _cache["docs"]:
        return _cache["docs"]
    try:
        db = get_db()
        categories = {c["categoryId"]: c.get("categoryName", "") for c in db["categories"].find({}, {"categoryId": 1, "categoryName": 1})}
        products = list(db["products"].find({"status": "ACTIVE"}))
    except Exception:
        if _cache["docs"]:
            return _cache["docs"]
        raise
    docs = []
    for p in products:
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
    cached = _stock_cache.get(store_id)
    if cached and time.time() - cached[0] < _CACHE_TTL:
        return cached[1]
    try:
        rows = list(get_db()["inventories"].find({"storeId": store_id}, {"productId": 1, "quantity": 1, "reservedQuantity": 1}))
    except Exception:
        if cached:
            return cached[1]
        raise
    ids = {r["productId"] for r in rows if r.get("quantity", 0) - r.get("reservedQuantity", 0) > 0}
    _stock_cache[store_id] = (time.time(), ids)
    return ids


def _cosine(a: dict, b: dict) -> float:
    if len(a) > len(b):
        a, b = b, a
    return sum(v * b.get(t, 0.0) for t, v in a.items())


def _rank(query_vec: dict, store_id: str | None, limit: int, exclude: set[str] | None = None, min_score: float = 0.0):
    docs = _load()
    stock = _in_stock(store_id)
    excluded = exclude or set()
    scored = []
    for d in docs:
        if d["productId"] in excluded or (stock is not None and d["productId"] not in stock):
            continue
        s = _cosine(query_vec, d["vec"])
        if s > min_score:
            scored.append((d, s))
    scored.sort(key=lambda x: x[1], reverse=True)
    return [{"productId": d["productId"], "name": d["name"], "price": d["price"], "score": round(s, 4)} for d, s in scored[:limit]]


def search(query: str, store_id: str | None, limit: int = 5) -> list[dict]:
    docs = _load()
    idf = _cache.get("idf", {})
    counts = Counter(t for t in query_tokens(query) if t in idf)
    vec = {t: c * idf[t] for t, c in counts.items()}
    norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
    return _rank({t: v / norm for t, v in vec.items()}, store_id, limit, min_score=0.05) if docs else []


def similar(product_id: str, store_id: str | None, limit: int = 8) -> list[dict]:
    base = next((d for d in _load() if d["productId"] == product_id), None)
    return _rank(base["vec"], store_id, limit, exclude={product_id}) if base else []


def personalized(customer_id: str, store_id: str | None, limit: int = 8) -> list[dict]:
    """Rank in-stock products from a customer's recent views, cart actions and completed orders."""
    docs = _load()
    by_id = {doc["productId"]: doc for doc in docs}
    db = get_db()
    interests: list[tuple[str, float]] = []
    activities = list(db["useractivities"].find(
        {"customerId": customer_id, "productId": {"$type": "string"}, "activityType": {"$in": ["VIEW", "ADD_TO_CART"]}},
        {"productId": 1, "activityType": 1},
    ).sort("createdAt", -1).limit(80))
    for index, activity in enumerate(activities):
        base = 3.0 if activity.get("activityType") == "ADD_TO_CART" else 1.0
        interests.append((activity["productId"], base * (0.985 ** index)))

    orders = list(db["orders"].find(
        {"customerId": customer_id, "orderStatus": {"$in": ["PREPARING", "READY_FOR_PICKUP", "SHIPPING", "DELIVERED"]}},
        {"orderId": 1},
    ).sort("createdAt", -1).limit(30))
    order_ids = [order["orderId"] for order in orders if order.get("orderId")]
    if order_ids:
        purchased = list(db["orderitems"].find({"orderId": {"$in": order_ids}}, {"orderId": 1, "productId": 1}))
        order_rank = {order_id: index for index, order_id in enumerate(order_ids)}
        for item in purchased:
            rank = order_rank.get(item.get("orderId"), len(order_rank))
            if item.get("productId"):
                interests.append((item["productId"], 5.0 * (0.94 ** rank)))

    if not interests:
        return []

    profile: Counter = Counter()
    excluded: set[str] = set()
    for product_id, weight in interests:
        doc = by_id.get(product_id)
        if not doc:
            continue
        excluded.add(product_id)
        for token, value in doc["vec"].items():
            profile[token] += value * weight
    norm = math.sqrt(sum(value * value for value in profile.values())) or 1.0
    profile = {token: value / norm for token, value in profile.items()}
    if not profile:
        return []
    return _rank(profile, store_id, limit, exclude=excluded, min_score=0.01)


def best_sellers(store_id: str | None, limit: int = 8) -> list[dict]:
    stock = _in_stock(store_id)
    docs = [d for d in _load() if stock is None or d["productId"] in stock]
    docs.sort(key=lambda d: d["soldCount"], reverse=True)
    return [{"productId": d["productId"], "name": d["name"], "price": d["price"], "score": float(d["soldCount"])} for d in docs[:limit]]

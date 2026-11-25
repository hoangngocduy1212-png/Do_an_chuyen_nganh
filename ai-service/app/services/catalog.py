import math
import re
import time
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from app.db.mongo import get_db

_CACHE_TTL = 300
_cache: dict = {"at": 0.0, "docs": []}
_stock_cache: dict[str, tuple[float, set[str]]] = {}
_purchase_cache: dict = {"at": 0.0, "neighbors": {}, "popularity": Counter()}


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
    # Tu hoi/generic khong nen dung de loc san pham
    "chon", "phu", "hop", "loai", "tot", "ngon", "tu", "van", "goi", "y", "thuc", "don", "gia", "dinh",
    "be", "em", "tre", "con", "nho", "nguoi", "lon", "hom", "nay", "cach", "che", "bien", "nau", "lam",
    "mon", "cong", "thuc", "an", "uong", "dung", "nen", "thich", "hop", "voi",
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
            "unit": p.get("unit", ""),
            "categoryId": p.get("categoryId", ""),
            "categoryName": categories.get(p.get("categoryId"), ""),
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


def _phrase_bonus(query: str, name: str) -> float:
    """Uu tien ten san pham chua cum tu khoa (2-3 tu) thay vi chi trung 1 token.

    Vi du "ca hoi" phai xep tren "ca chua"/"ca phe" du ca hai deu co token "ca".
    """
    words = [w for w in re.findall(r"[a-z0-9]+", normalize(query)) if w not in QUERY_STOPWORDS]
    name_norm = normalize(name)
    best = 0
    for size in (3, 2):
        for index in range(len(words) - size + 1):
            phrase = " ".join(words[index:index + size])
            if phrase in name_norm:
                best = max(best, size)
    return best * 0.2


def _rank(query_vec: dict, store_id: str | None, limit: int, exclude: set[str] | None = None,
          min_score: float = 0.0, query_text: str | None = None):
    docs = _load()
    stock = _in_stock(store_id)
    excluded = exclude or set()
    scored = []
    for d in docs:
        if d["productId"] in excluded or (stock is not None and d["productId"] not in stock):
            continue
        s = _cosine(query_vec, d["vec"])
        if query_text:
            s += _phrase_bonus(query_text, d["name"])
        if s > min_score:
            scored.append((d, s))
    scored.sort(key=lambda x: x[1], reverse=True)
    return [{
        "productId": d["productId"],
        "name": d["name"],
        "price": d["price"],
        "unit": d.get("unit", ""),
        "categoryName": d.get("categoryName", ""),
        "inStock": True,
        "score": round(s, 4),
    } for d, s in scored[:limit]]


def search(query: str, store_id: str | None, limit: int = 5) -> list[dict]:
    docs = _load()
    idf = _cache.get("idf", {})
    counts = Counter(t for t in query_tokens(query) if t in idf)
    vec = {t: c * idf[t] for t, c in counts.items()}
    norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
    if not docs or not vec:
        return []
    # Lay rong hon roi cat theo diem tuong doi de loai ket qua chi trung 1 token chung chung
    # (vi du "ca phe" lot vao ket qua cua "ca hoi").
    ranked = _rank({t: v / norm for t, v in vec.items()}, store_id, max(limit * 4, 12),
                   min_score=0.05, query_text=query)
    if not ranked:
        return []
    # Voi cau hoi nhieu tu, yeu cau san pham khop phan lon tu khoa hoac khop cum
    # (vi du "nuoc tuong" khong duoc tra ve "nuoc suoi"/"nuoc cam").
    query_words = {w for w in re.findall(r"[a-z0-9]+", normalize(query)) if w not in QUERY_STOPWORDS}
    filtered = []
    for row in ranked:
        name_words = set(re.findall(r"[a-z0-9]+", normalize(row["name"])))
        coverage = len(query_words & name_words) / len(query_words) if query_words else 1.0
        phrase = _phrase_bonus(query, row["name"])
        if len(query_words) >= 2 and coverage < 0.6 and phrase < 0.4:
            continue
        filtered.append(row)
    if not filtered:
        return []
    top = filtered[0]["score"]
    cutoff = max(0.05, top * 0.42)
    return [row for row in filtered if row["score"] >= cutoff][:limit]


def similar(product_id: str, store_id: str | None, limit: int = 8) -> list[dict]:
    base = next((d for d in _load() if d["productId"] == product_id), None)
    return _rank(base["vec"], store_id, limit, exclude={product_id}) if base else []

def _purchase_signals() -> tuple[dict[str, Counter], Counter]:
    """Build item-item co-purchase signals from delivered orders, cached briefly."""
    if time.time() - _purchase_cache["at"] < _CACHE_TTL:
        return _purchase_cache["neighbors"], _purchase_cache["popularity"]

    db = get_db()
    since = datetime.now(timezone.utc) - timedelta(days=180)
    orders = list(db["orders"].find(
        {"orderStatus": "DELIVERED", "createdAt": {"$gte": since}},
        {"orderId": 1},
    ).sort("createdAt", -1).limit(10000))
    order_ids = [order["orderId"] for order in orders if order.get("orderId")]
    neighbors: dict[str, Counter] = defaultdict(Counter)
    popularity: Counter = Counter()
    customer_items: dict[str, Counter] = defaultdict(Counter)
    for event in db["useractivities"].find(
        {"productId": {"$type": "string"}, "activityType": {"$in": ["VIEW", "ADD_TO_CART"]}, "createdAt": {"$gte": since}},
        {"customerId": 1, "productId": 1, "activityType": 1},
    ):
        product_id = event["productId"]
        weight = 3.0 if event.get("activityType") == "ADD_TO_CART" else 1.0
        popularity[product_id] += weight
        if event.get("customerId"):
            customer_items[event["customerId"]][product_id] += weight
    for review in db["reviews"].find(
        {"isHidden": {"$ne": True}, "rating": {"$gte": 4}},
        {"customerId": 1, "productId": 1, "rating": 1},
    ):
        product_id = review.get("productId")
        if not product_id:
            continue
        weight = 2.0 * review.get("rating", 4) / 5
        popularity[product_id] += weight
        if review.get("customerId"):
            customer_items[review["customerId"]][product_id] += weight
    for items in customer_items.values():
        for product_id, weight in items.items():
            for related_id, related_weight in items.items():
                if related_id != product_id:
                    neighbors[product_id][related_id] += math.sqrt(weight * related_weight)
    if order_ids:
        grouped: dict[str, set[str]] = defaultdict(set)
        for row in db["orderitems"].find(
            {"orderId": {"$in": order_ids}}, {"orderId": 1, "productId": 1},
        ):
            if row.get("orderId") and row.get("productId"):
                grouped[row["orderId"]].add(row["productId"])
        for product_ids in grouped.values():
            for product_id in product_ids:
                popularity[product_id] += 5
                for related_id in product_ids:
                    if related_id != product_id:
                        neighbors[product_id][related_id] += 1

    _purchase_cache.update(at=time.time(), neighbors=dict(neighbors), popularity=popularity)
    return _purchase_cache["neighbors"], _purchase_cache["popularity"]


def _customer_interests(customer_id: str) -> list[tuple[str, float]]:
    db = get_db()
    interests: list[tuple[str, float]] = []
    activities = list(db["useractivities"].find(
        {"customerId": customer_id, "productId": {"$type": "string"}, "activityType": {"$in": ["VIEW", "ADD_TO_CART"]}},
        {"productId": 1, "activityType": 1},
    ).sort("createdAt", -1).limit(80))
    for index, activity in enumerate(activities):
        weight = 3.0 if activity.get("activityType") == "ADD_TO_CART" else 1.0
        interests.append((activity["productId"], weight * (0.985 ** index)))

    orders = list(db["orders"].find(
        {"customerId": customer_id, "orderStatus": "DELIVERED"}, {"orderId": 1},
    ).sort("createdAt", -1).limit(30))
    order_ids = [order["orderId"] for order in orders if order.get("orderId")]
    if order_ids:
        order_rank = {order_id: index for index, order_id in enumerate(order_ids)}
        for item in db["orderitems"].find(
            {"orderId": {"$in": order_ids}}, {"orderId": 1, "productId": 1},
        ):
            product_id = item.get("productId")
            if product_id:
                rank = order_rank.get(item.get("orderId"), len(order_rank))
                interests.append((product_id, 5.0 * (0.94 ** rank)))
    for review in db["reviews"].find(
        {"customerId": customer_id, "isHidden": {"$ne": True}, "rating": {"$gte": 4}},
        {"productId": 1, "rating": 1},
    ).sort("createdAt", -1).limit(30):
        if review.get("productId"):
            interests.append((review["productId"], 2.0 * review.get("rating", 4) / 5))
    return interests


def _normalized(values: dict[str, float]) -> dict[str, float]:
    peak = max(values.values(), default=0.0)
    if peak <= 0:
        return {}
    return {key: value / peak for key, value in values.items()}


def recommend_hybrid(customer_id: str | None, store_id: str | None, limit: int = 8,
                     product_id: str | None = None, placement: str = "home") -> tuple[list[dict], str]:
    """Blend collaborative purchases, TF-IDF content and popularity; keep cold-start useful."""
    docs = _load()
    if not docs:
        return [], "unavailable"
    stock = _in_stock(store_id)
    candidates = [doc for doc in docs if stock is None or doc["productId"] in stock]
    if not candidates:
        return [], "no-in-stock-products"

    neighbors, purchase_popularity = _purchase_signals()
    interests = _customer_interests(customer_id) if customer_id else []
    if product_id:
        interests.append((product_id, 5.0))
    by_id = {doc["productId"]: doc for doc in docs}
    excluded = {item_id for item_id, _ in interests if customer_id and item_id in by_id}
    if product_id:
        excluded.add(product_id)

    cf_scores: Counter = Counter()
    content_profile: Counter = Counter()
    for item_id, weight in interests:
        for related_id, count in neighbors.get(item_id, {}).items():
            cf_scores[related_id] += weight * math.log1p(count)
        source = by_id.get(item_id)
        if source:
            for token, value in source["vec"].items():
                content_profile[token] += value * weight

    profile_norm = math.sqrt(sum(value * value for value in content_profile.values())) or 1.0
    content_profile = {token: value / profile_norm for token, value in content_profile.items()}
    cb_scores = {doc["productId"]: _cosine(content_profile, doc["vec"])
                 for doc in candidates} if content_profile else {}
    cf_scores = {doc["productId"]: cf_scores.get(doc["productId"], 0.0)
                 for doc in candidates}
    now = datetime.now(timezone.utc)
    pop_scores = {}
    for doc in candidates:
        created = doc.get("createdAt")
        age_days = 365.0
        if created:
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            age_days = max(0.0, (now - created.astimezone(timezone.utc)).total_seconds() / 86400)
        recentness = 1 / (1 + age_days / 30)
        signal = max(0, doc["soldCount"]) + purchase_popularity.get(doc["productId"], 0)
        signal += max(0, doc["reviewCount"]) * max(0, doc["avgRating"]) / 5
        pop_scores[doc["productId"]] = math.log1p(signal) + 0.1 * recentness

    cf_norm, cb_norm, pop_norm = map(_normalized, (cf_scores, cb_scores, pop_scores))
    if customer_id and interests and (cf_norm or cb_norm):
        available_weights = {"cf": 0.5, "cb": 0.3, "pop": 0.2}
        components = {"cf": cf_norm, "cb": cb_norm, "pop": pop_norm}
        active_weight = sum(weight for name, weight in available_weights.items() if components[name])
        scores = {
            doc["productId"]: sum(
                weight * components[name].get(doc["productId"], 0.0) / active_weight
                for name, weight in available_weights.items() if components[name]
            )
            for doc in candidates
        }
        strategy = "hybrid-personalized"
    elif product_id and cb_norm:
        available_weights = {"cf": 0.5, "cb": 0.3, "pop": 0.2}
        components = {"cf": cf_norm, "cb": cb_norm, "pop": pop_norm}
        active_weight = sum(weight for name, weight in available_weights.items() if components[name])
        scores = {
            doc["productId"]: sum(
                weight * components[name].get(doc["productId"], 0.0) / active_weight
                for name, weight in available_weights.items() if components[name]
            )
            for doc in candidates
        }
        strategy = "hybrid-cart" if placement == "cart" else "hybrid-content"
    else:
        scores = pop_norm
        strategy = "cold-start-popularity"

    ranked = sorted(
        (doc for doc in candidates if doc["productId"] not in excluded),
        key=lambda doc: (scores.get(doc["productId"], 0.0), doc["soldCount"], doc["productId"]),
        reverse=True,
    )[:limit]
    result = []
    for doc in ranked:
        reason = "frequently-bought-together" if cf_norm.get(doc["productId"], 0) > 0 else (
            "content-similarity" if cb_norm.get(doc["productId"], 0) > 0 else "popular"
        )
        result.append({"productId": doc["productId"], "score": round(scores.get(doc["productId"], 0.0), 4), "reason": reason})
    return result, strategy

def personalized(customer_id: str, store_id: str | None, limit: int = 8) -> list[dict]:
    """Rank in-stock products from a customer's recent views, cart actions and completed orders."""
    rows, _strategy = recommend_hybrid(customer_id, store_id, limit)
    by_id = {doc["productId"]: doc for doc in _load()}
    return [{**by_id[row["productId"]], **row} for row in rows if row["productId"] in by_id]


def best_sellers(store_id: str | None, limit: int = 8) -> list[dict]:
    rows, _strategy = recommend_hybrid(None, store_id, limit)
    by_id = {doc["productId"]: doc for doc in _load()}
    return [{**by_id[row["productId"]], **row} for row in rows if row["productId"] in by_id]

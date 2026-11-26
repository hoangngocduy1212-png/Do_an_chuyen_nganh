import logging
import re
import unicodedata

from app.core.config import settings
from app.core.security import Caller
from app.integrations import ecommerce_client as shop
from app.integrations import file_catalog
from app.mock import catalog as mock
from app.rag import embedding, vector_store

log = logging.getLogger("tools")

# Whitelist công cụ, tất cả chỉ đọc (riêng request_human_support chỉ đánh dấu cờ).
TOOL_SPECS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": "Tìm sản phẩm trong cửa hàng theo tên hoặc mô tả. Trả về giá và tồn kho hiện tại.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Tên hoặc mô tả sản phẩm khách hỏi"},
                    "category": {"type": "string", "description": "Danh mục (tùy chọn)"},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_knowledge",
            "description": "Tra cứu chính sách giao hàng, đổi trả, FAQ, hướng dẫn mua hàng.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_order",
            "description": "Xem đơn hàng của chính khách đang chat. Bỏ trống order_id để xem các đơn gần đây.",
            "parameters": {
                "type": "object",
                "properties": {"order_id": {"type": "string"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_human_support",
            "description": "Chuyển cho nhân viên khi khách phàn nàn, muốn gặp người thật hoặc bạn không chắc chắn.",
            "parameters": {
                "type": "object",
                "properties": {"reason": {"type": "string"}},
                "required": ["reason"],
            },
        },
    },
]


def _norm_text(text: str) -> str:
    text = unicodedata.normalize("NFD", (text or "").lower().replace("đ", "d"))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]", " ", text)


def _coverage(query: str, name: str) -> float:
    tokens = [t for t in _norm_text(query).split() if len(t) > 1]
    if not tokens:
        return 0.0
    words = set(_norm_text(name).split())
    return sum(1 for token in tokens if token in words) / len(tokens)


async def _search_products(query: str, category: str | None, store_id: str | None = None) -> dict:
    if settings.data_backend == "mock":
        hits = mock.search_scored(query, 5, category, top_only=True) or mock.search_scored(query, 5, top_only=True)
        products = [p for p, _ in hits]
        return {"products": products} if products else {"products": [], "note": "Không tìm thấy sản phẩm phù hợp."}
    ids: list[str] = []
    try:
        vec = (await embedding.embed_texts([query]))[0]
        hits = await vector_store.search("products_text", vec, limit=15, filters={"category": category} if category else None)
        if category and not hits:
            hits = await vector_store.search("products_text", vec, limit=15)
        for h in hits:
            payload = h.payload or {}
            pid = payload.get("product_id")
            name = payload.get("name", "")
            # Qdrant luôn trả top-k; chặn kết quả chỉ giống mờ (ví dụ "sữa tươi" -> "vú sữa").
            if pid and h.score >= settings.text_min_score and _coverage(query, name) >= 0.6 and pid not in ids:
                ids.append(pid)
    except Exception:
        log.exception("Qdrant/embedding search failed; falling back to file keyword search")
        ids = []
    if settings.data_backend == "file":
        products = file_catalog.get_products(ids) if ids else file_catalog.search(query, 5)
        # File chỉ có danh mục; tồn kho lấy realtime từ NestJS theo cửa hàng.
        if products and store_id:
            try:
                live = await shop.get_products([str(p["id"]) for p in products], store_id)
                stock_by_id = {str(p.get("productId") or p.get("id")): p for p in live}
                for product in products:
                    live_product = stock_by_id.get(str(product["id"]))
                    if live_product and live_product.get("stock") is not None:
                        product["stock"] = live_product["stock"]
                        product["available"] = live_product.get("available")
            except Exception:
                log.warning("Không lấy được tồn kho realtime từ NestJS", exc_info=True)
        return {"products": products} if products else {"products": [], "note": "Không tìm thấy sản phẩm phù hợp."}
    if not ids:
        return {"products": [], "note": "Không tìm thấy sản phẩm phù hợp."}
    return {"products": await shop.get_products(ids, store_id)}  # giá/tồn kho realtime từ NestJS


async def _search_knowledge(query: str) -> dict:
    if settings.data_backend == "mock":
        docs = mock.search_knowledge(query)
        return {"documents": docs} if docs else {"documents": [], "note": "Không có tài liệu liên quan."}
    vec =(await embedding.embed_texts([query]))[0]
    hits = await vector_store.search("knowledge", vec, limit=3)
    docs = [
        {"title": (h.payload or {}).get("title"), "text": (h.payload or {}).get("text")}
        for h in hits
        if h.score >= settings.text_min_score
    ]
    return {"documents": docs} if docs else {"documents": [], "note": "Không có tài liệu liên quan."}


async def run_tool(name: str, args: dict, caller: Caller) -> dict:
    """user_id luôn lấy từ caller (NestJS xác thực), không bao giờ từ tham số do LLM sinh ra."""
    try:
        if name == "search_products":
            return await _search_products(str(args.get("query", "")), args.get("category"), caller.store_id)
        if name == "search_knowledge":
            return await _search_knowledge(str(args.get("query", "")))
        if name == "get_my_order":
            if settings.data_backend == "mock":
                data = mock.orders(caller.user_id, args.get("order_id"))
            else:
                data = await shop.get_my_orders(caller.user_id, args.get("order_id"))
            return {"orders": data} if data else {"orders": [], "note": "Không tìm thấy đơn hàng."}
        if name == "request_human_support":
            return {"handoff": True, "reason": str(args.get("reason", ""))}
    except Exception:
        log.exception("tool %s failed (request_id=%s)", name, caller.request_id)
        return {"error": "Không lấy được dữ liệu lúc này, hãy báo khách thử lại sau."}
    return {"error": f"Công cụ không tồn tại: {name}"}

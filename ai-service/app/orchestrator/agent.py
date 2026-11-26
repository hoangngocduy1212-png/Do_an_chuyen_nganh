import json
import re
from dataclasses import dataclass, field

from app.core.config import settings
from app.core.security import Caller
from app.llm import ollama_client
from app.llm.prompts import FALLBACK_REPLY, SYSTEM_PROMPT
from app.orchestrator.tools import TOOL_SPECS, run_tool


@dataclass
class AgentResult:
    reply: str
    products: list[dict] = field(default_factory=list)
    handoff: bool = False


INJECTION_PATTERNS = (
    "bỏ qua quy tắc", "bỏ qua mọi quy tắc", "ignore previous", "ignore all previous",
    "system prompt", "toàn bộ đơn hàng của người khác", "đơn hàng của người khác",
    "xem đơn của người khác", "đọc dữ liệu người khác",
)


def _is_injection(text: str) -> bool:
    lowered = (text or "").lower()
    return any(pattern in lowered for pattern in INJECTION_PATTERNS)


async def answer(history: list[dict], user_text: str, caller: Caller) -> AgentResult:
    """Qwen3.5 là não: tự chọn công cụ, đọc kết quả, rồi diễn đạt câu trả lời."""
    if _is_injection(user_text):
        return AgentResult(
            reply="Tôi không thể làm điều đó. Tôi chỉ hỗ trợ xem đơn hàng của chính bạn "
                  "và không truy cập dữ liệu của khách hàng khác."
        )
    # Câu hỏi giá/tồn kho: tra thẳng bằng câu gốc để không phụ thuộc việc model
    # có bỏ sót số lượng/quy cách khi gọi công cụ.
    if _asks_price(user_text) or _asks_stock(user_text):
        direct = await run_tool("search_products", {"query": user_text}, caller)
        direct_products = direct.get("products") or []
        if direct_products:
            return AgentResult(
                reply=_clean_text(_products_reply(
                    direct_products,
                    include_stock=_asks_stock(user_text),
                    query=user_text,
                )),
                products=direct_products,
            )

    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *history, {"role": "user", "content": user_text}]
    result = AgentResult(reply="")
    tool_used = False

    # Chỉ cho gọi công cụ ở lượt đầu. Sau khi có dữ liệu, tắt tools để model
    # buộc trả lời; qwen3.5:2b có thể lặp gọi tool vô hạn nếu vẫn mở tools.
    for _ in range(settings.max_tool_rounds):
        msg = await ollama_client.chat(messages, tools=None if tool_used else TOOL_SPECS)
        calls = msg.get("tool_calls") or []
        if not calls or tool_used:
            content = (msg.get("content") or "").strip()
            if result.products:
                # Trả lời từ dữ liệu sản phẩm để không sai đơn vị / bị model cắt cụt số.
                if _asks_price(user_text) or _asks_stock(user_text):
                    result.reply = _products_reply(result.products, include_stock=_asks_stock(user_text), query=user_text)
                else:
                    result.reply = _products_list_reply(result.products, query=user_text)
            else:
                result.reply = content or FALLBACK_REPLY
            result.reply = _clean_text(result.reply)
            has_stock = any(product.get("stock") is not None for product in result.products)
            result.reply = _strip_unsolicited_stock(result.reply, user_text, result.products)
            if settings.data_backend == "file" and not has_stock and _asks_stock(user_text):
                result.reply = _strip_stock_claims(result.reply)
            return result

        tool_used = True
        messages.append(msg)
        for call in calls:
            fn = call.get("function", {})
            name = fn.get("name", "")
            args = fn.get("arguments") or {}
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except json.JSONDecodeError:
                    args = {}
            out = await run_tool(name, args, caller)
            if out.get("products"):
                result.products = out["products"]
            if out.get("handoff"):
                result.handoff = True
            messages.append(
                {
                    "role": "tool",
                    "tool_name": name,
                    "tool_call_id": call.get("id", ""),
                    "content": json.dumps(out, ensure_ascii=False, default=str),
                }
            )

    if result.products:
        result.reply = (
            _products_reply(result.products, include_stock=_asks_stock(user_text), query=user_text)
            if (_asks_price(user_text) or _asks_stock(user_text))
            else _products_list_reply(result.products, query=user_text)
        )
    else:
        result.reply = FALLBACK_REPLY
    return result


def _asks_price(text: str) -> bool:
    return bool(re.search(r"giá|bao nhiêu|price", text or "", re.I))


def _asks_stock(text: str) -> bool:
    return bool(re.search(r"tồn kho|còn hàng|hết hàng|còn không|số lượng|còn bao nhiêu", text or "", re.I))


def _strip_unsolicited_stock(text: str, user_text: str, products: list[dict]) -> str:
    """Không chèn câu tồn kho khi khách chỉ hỏi giá/sản phẩm."""
    if _asks_stock(user_text):
        return text
    cleaned = re.sub(
        r"[^.!?\n]*(tồn kho|còn hàng|hết hàng|trong kho|có sẵn)[^.!?\n]*[.!?]?",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned or _products_reply(products) or text


def _products_reply(products: list[dict], include_stock: bool = False, query: str = "") -> str:
    if not products:
        return ""
    product = _best_product(products, query)
    reply = f"{product.get('name', 'Sản phẩm')} có giá {_product_price_text(product)}."
    if include_stock:
        stock = product.get("stock")
        if stock is None:
            reply += " Hiện chưa có thông tin tồn kho realtime."
        elif int(stock) > 0:
            reply += f" Hiện còn {int(stock)} sản phẩm."
        else:
            reply += " Hiện tạm hết hàng."
    return reply


def _rank_products(products: list[dict], query: str) -> list[dict]:
    """Xếp sản phẩm theo độ khớp với câu hỏi, tránh lấy top-1 của Qdrant khi có nhiều biến thể."""
    import unicodedata

    def tokens(text: str) -> set[str]:
        text = unicodedata.normalize("NFD", (text or "").lower().replace("đ", "d"))
        text = "".join(c for c in text if unicodedata.category(c) != "Mn")
        return {t for t in re.findall(r"[a-z0-9.]+", text) if len(t) > 1}

    stop = {"gia", "la", "bao", "nhieu", "cua", "cho", "toi", "muon", "mua", "khong", "co", "ban", "san", "pham"}
    query_tokens = tokens(query) - stop
    if not query_tokens:
        return products
    numeric = {t for t in query_tokens if any(ch.isdigit() for ch in t)}

    def score(product: dict) -> float:
        name_tokens = tokens(product.get("name", ""))
        coverage = len(query_tokens & name_tokens) / len(query_tokens)
        numeric_score = len(numeric & name_tokens) / len(numeric) if numeric else 0.0
        return coverage + numeric_score

    return sorted(products, key=score, reverse=True)


def _best_product(products: list[dict], query: str) -> dict:
    return _rank_products(products, query)[0]


def _product_price_text(product: dict) -> str:
    if product.get("price_text"):
        return str(product["price_text"])
    price = product.get("price")
    try:
        text = f"{int(price):,}".replace(",", ".") + "đ"
    except (TypeError, ValueError):
        return "chưa có giá"
    return text + (f"/{product['unit']}" if product.get("unit") else "")


def _products_list_reply(products: list[dict], query: str = "") -> str:
    ranked = _rank_products(products, query)[:3]
    lines = ["Tôi tìm thấy các sản phẩm phù hợp:"]
    for product in ranked:
        lines.append(f"- {product.get('name', 'Sản phẩm')}: {_product_price_text(product)}")
    lines.append("Bạn muốn xem chi tiết sản phẩm nào?")
    return "\n".join(lines)


def _clean_text(text: str) -> str:
    """Bỏ markdown ảnh/đậm không cần thiết để ChatWidget hiển thị sạch."""
    cleaned = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    cleaned = cleaned.replace("**", "").replace("__", "")
    return re.sub(r"(?m)^#{1,6}\s*", "", cleaned).strip()


def _strip_stock_claims(text: str) -> str:
    """File catalog không có tồn kho: chặn model tự khẳng định còn/hết hàng."""
    cleaned = re.sub(
        r"[^.!?\n]*(còn hàng|hết hàng|trong kho|có sẵn)[^.!?\n]*[.!?]?",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    if cleaned != text.strip():
        cleaned = (cleaned + "\n\nHiện chưa có thông tin tồn kho realtime.").strip()
    return cleaned or "Hiện chưa có thông tin tồn kho realtime."

import json
import logging

import httpx

from app.core.config import settings
from app.schemas.chat import ChatRequest, ChatResponse
from app.services import catalog

log = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Bạn là trợ lý mua sắm của siêu thị Muadee. Trả lời ngắn gọn bằng tiếng Việt. "
    "Khi khách hỏi về sản phẩm, gợi ý, món ăn hay nguyên liệu, BẮT BUỘC gọi công cụ search_products "
    "rồi chỉ giới thiệu các sản phẩm do công cụ trả về. Không bịa sản phẩm hay giá. "
    "Nếu không có thông tin hoặc khách cần người hỗ trợ, nói rõ và đề nghị chuyển nhân viên."
)

TOOLS = [{
    "type": "function",
    "function": {
        "name": "search_products",
        "description": "Tìm sản phẩm đang bán và còn hàng tại cửa hàng của khách.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "Từ khóa sản phẩm, ví dụ 'sữa tươi', 'rau canh chua'"}},
            "required": ["query"],
        },
    },
}]


def _fallback(req: ChatRequest) -> ChatResponse:
    rows = catalog.search(req.message, req.storeId, 4)
    if not rows:
        return ChatResponse(answer="Mình chưa tìm thấy sản phẩm phù hợp. Bạn có thể mô tả cụ thể hơn hoặc chuyển sang nhân viên hỗ trợ.", needHandover=False)
    names = ", ".join(r["name"] for r in rows)
    return ChatResponse(answer=f"Mình gợi ý cho bạn: {names}.", productIds=[r["productId"] for r in rows])


def _llm(req: ChatRequest) -> ChatResponse:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": "user" if m.role == "user" else "assistant", "content": m.content} for m in req.history]
    messages.append({"role": "user", "content": req.message})
    product_ids: list[str] = []
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    model = settings.llm_model or "gpt-4o-mini"

    with httpx.Client(timeout=20) as client:
        for _ in range(3):
            r = client.post("https://api.openai.com/v1/chat/completions", headers=headers,
                            json={"model": model, "messages": messages, "tools": TOOLS})
            r.raise_for_status()
            msg = r.json()["choices"][0]["message"]
            calls = msg.get("tool_calls")
            if not calls:
                return ChatResponse(answer=msg.get("content") or "", productIds=product_ids)
            messages.append(msg)
            for call in calls:
                args = json.loads(call["function"]["arguments"] or "{}")
                rows = catalog.search(args.get("query", req.message), req.storeId, 5)
                for row in rows:
                    if row["productId"] not in product_ids:
                        product_ids.append(row["productId"])
                messages.append({"role": "tool", "tool_call_id": call["id"], "content": json.dumps(rows, ensure_ascii=False)})
    return _fallback(req)


def _ollama(req: ChatRequest) -> ChatResponse:
    # Model nho goi tool khong on dinh: tim san pham truoc, roi de model dien dat.
    rows = catalog.search(req.message, req.storeId, 5)
    if not rows:
        return _fallback(req)
    listing = "\n".join(f"- {r['name']} ({r['price']:,.0f}đ)" for r in rows)
    system = SYSTEM_PROMPT.split(" Khi khách")[0] + (
        " Chỉ giới thiệu các sản phẩm trong danh sách sau, không thêm sản phẩm khác, tối đa 3 câu.\n" + listing
    )
    messages = [{"role": "system", "content": system}]
    messages += [{"role": "user" if m.role == "user" else "assistant", "content": m.content} for m in req.history[-6:]]
    messages.append({"role": "user", "content": f"{req.message}\n\nDanh sách sản phẩm có sẵn:\n    {listing}\n\nHãy giới thiệu ngắn gọn các sản phẩm trên bằng tiếng Việt."})
    r = httpx.post(f"{settings.ollama_url}/api/chat", timeout=60,
                   json={"model": settings.llm_model or "llama3.2:1b", "messages": messages, "stream": False})
    r.raise_for_status()
    text = r.json()["message"]["content"].strip()
    return ChatResponse(answer=text or "Mình gợi ý các sản phẩm bên dưới.", productIds=[x["productId"] for x in rows])


def answer(req: ChatRequest) -> ChatResponse:
    provider = settings.llm_provider.lower()
    if provider == "ollama":
        try:
            return _ollama(req)
        except Exception as exc:
            log.warning("Ollama chat failed: %s", exc)
    elif provider == "openai" and settings.llm_api_key:
        try:
            return _llm(req)
        except Exception as exc:  # LLM/DB loi -> van tra loi bang tim kiem tu khoa
            log.warning("LLM chat failed: %s", exc)
    try:
        return _fallback(req)
    except Exception as exc:
        log.warning("Catalog search failed: %s", exc)
        return ChatResponse(answer="Hiện mình chưa tra cứu được sản phẩm. Bạn thử lại sau hoặc chuyển sang nhân viên hỗ trợ.", needHandover=True)

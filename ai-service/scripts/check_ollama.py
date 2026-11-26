"""Kiểm tra Ollama trước khi chạy chatbot: server, model đã tải, chat cơ bản, tham số think, tool calling.

Chạy:  python scripts/check_ollama.py
Biến môi trường (tùy chọn): OLLAMA_URL, CHAT_MODEL
"""
import json
import os
import sys
import time

import httpx

URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = os.getenv("CHAT_MODEL", "qwen3.5:9b")

TOOL = {
    "type": "function",
    "function": {
        "name": "search_products",
        "description": "Tìm sản phẩm trong cửa hàng theo tên. Trả về giá và tồn kho.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    },
}


def step(name: str, ok: bool, detail: str = "") -> bool:
    print(f"[{'OK' if ok else 'LỖI'}] {name}" + (f" - {detail}" if detail else ""))
    return ok


def chat(client: httpx.Client, messages: list[dict], **extra) -> tuple[dict, float]:
    body = {"model": MODEL, "messages": messages, "stream": False, "think": False,
            "options": {"temperature": 0.2, "num_ctx": 4096}, **extra}
    t = time.time()
    r = client.post(f"{URL}/api/chat", json=body)
    r.raise_for_status()
    return r.json()["message"], time.time() - t


def main() -> int:
    with httpx.Client(timeout=300) as client:
        try:
            tags = client.get(f"{URL}/api/tags", timeout=5).json()
        except httpx.HTTPError as e:
            step("Ollama server", False, f"không kết nối được {URL}: {e}. Hãy mở Ollama rồi chạy lại.")
            return 1
        step("Ollama server", True, URL)

        names = [m.get("name", "") for m in tags.get("models", [])]
        if not step(f"Model {MODEL} đã tải", any(n == MODEL or n.startswith(MODEL + ":") for n in names),
                    f"đang có: {', '.join(names) or 'không có model nào'}. Chạy: ollama pull {MODEL}"):
            return 1

        try:
            msg, secs = chat(client, [{"role": "user", "content": "Chào bạn, trả lời đúng một câu ngắn bằng tiếng Việt."}])
            step("Chat cơ bản", bool(msg.get("content", "").strip()), f"{secs:.1f}s (lần đầu gồm cả thời gian nạp model): {msg.get('content', '').strip()[:80]}")
            step("Tắt suy luận (think=false)", not msg.get("thinking"), "không có nội dung suy luận" if not msg.get("thinking") else "model vẫn trả suy luận, cần xem lại phiên bản Ollama")
        except httpx.HTTPStatusError as e:
            step("Chat cơ bản", False, e.response.text[:200])
            return 1

        try:
            msg, secs = chat(client, [{"role": "user", "content": "Shop có táo Envy không và giá bao nhiêu?"}], tools=[TOOL])
            calls = msg.get("tool_calls") or []
            ok = bool(calls) and calls[0]["function"]["name"] == "search_products"
            step("Tool calling", ok, f"{secs:.1f}s " + (json.dumps(calls[0]["function"], ensure_ascii=False) if calls else "model không gọi công cụ, chatbot sẽ không tra được dữ liệu"))
            return 0 if ok else 1
        except httpx.HTTPStatusError as e:
            step("Tool calling", False, e.response.text[:200])
            return 1


if __name__ == "__main__":
    sys.exit(main())

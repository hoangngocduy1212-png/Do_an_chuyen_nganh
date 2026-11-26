import asyncio

import httpx

from app.core.config import settings

# Một model chạy cả chat lẫn ảnh: chỉ cho xử lý số request đồng thời rất ít.
_sem = asyncio.Semaphore(settings.llm_concurrency)


async def chat(messages: list[dict], tools: list[dict] | None = None, fmt: str | None = None) -> dict:
    """Gọi LLM đã cấu hình, trả về message assistant (có thể chứa tool_calls)."""
    if settings.llm_provider.strip().lower() == "openai":
        return await _openai_chat(messages, tools, fmt)

    body: dict = {
        "model": settings.chat_model,
        "messages": messages,
        "stream": False,
        # Tắt chế độ suy luận để nhanh hơn và không phá định dạng JSON (cần kiểm tra trên bản Ollama đang dùng).
        "think": False,
        "options": {"temperature": 0.2, "num_ctx": settings.num_ctx},
    }
    if tools:
        body["tools"] = tools
    if fmt:
        body["format"] = fmt
    async with _sem:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_s) as client:
            r = await client.post(f"{settings.ollama_url}/api/chat", json=body)
            r.raise_for_status()
            return r.json()["message"]


async def _openai_chat(messages: list[dict], tools: list[dict] | None = None, fmt: str | None = None) -> dict:
    """Provider tương thích OpenAI (OpenAI, relay Claude/GPT...)."""
    if not settings.llm_api_key:
        raise RuntimeError("Thiếu LLM_API_KEY cho provider openai")
    normalized = []
    for message in messages:
        item = dict(message)
        images = item.pop("images", None)
        if images:
            # Ollama nhận `images`; OpenAI/relay nhận content dạng image_url.
            item["content"] = [
                {"type": "text", "text": item.get("content") or ""},
                *[
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image}"}}
                    for image in images
                ],
            ]
        normalized.append(item)
    body: dict = {
        "model": settings.llm_model or settings.chat_model,
        "messages": normalized,
        "temperature": 0.2,
        "max_tokens": settings.llm_max_tokens,
    }
    if tools:
        body["tools"] = tools
        body["tool_choice"] = "auto"
    if fmt:
        body["response_format"] = {"type": "json_object"}
    async with _sem:
        async with httpx.AsyncClient(timeout=settings.llm_timeout_s) as client:
            r = await client.post(
                f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.llm_api_key.strip()}"},
                json=body,
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]


async def embed(texts: list[str]) -> list[list[float]]:
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{settings.ollama_url}/api/embed",
            json={"model": settings.embed_model, "input": texts},
        )
        r.raise_for_status()
        return r.json()["embeddings"]

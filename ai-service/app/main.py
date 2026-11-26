import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI

from app.api import chat, image, knowledge
from app.core.config import settings
from app.rag import vector_store
from app.repositories import conversations

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("store_backend=%s data_backend=%s model=%s", settings.store_backend, settings.data_backend, settings.chat_model)
    try:
        await conversations.ensure_indexes()  # với mongo: tạo index và kiểm tra kết nối
    except Exception:
        log.exception("Không kết nối được kho hội thoại (%s); kiểm tra MONGO_URI hoặc đặt STORE_BACKEND=memory", settings.store_backend)
    if settings.data_backend != "mock":
        try:
            await vector_store.ensure_collections()
        except Exception:
            log.exception("Không tạo được collection Qdrant; kiểm tra QDRANT_URL")
    yield


app = FastAPI(title="Muadee Chatbot Service", lifespan=lifespan)
app.include_router(chat.router)
app.include_router(image.router)
app.include_router(knowledge.router)


@app.get("/health")
async def health():
    """Kiểm tra server và Ollama (model chat đã được tải chưa)."""
    provider = settings.llm_provider.strip().lower()
    if provider == "openai":
        model = settings.llm_model or settings.chat_model
        configured = bool(settings.llm_api_key and settings.llm_base_url)
        return {
            "status": "ok" if configured else "degraded",
            "provider": "openai",
            "model": model,
            "chat_model_installed": configured,
            "store_backend": settings.store_backend,
            "data_backend": settings.data_backend,
        }
    ollama_ok, model_ok = False, False
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{settings.ollama_url}/api/tags")
            r.raise_for_status()
            ollama_ok = True
            names = [m.get("name", "") for m in r.json().get("models", [])]
            model_ok = any(n == settings.chat_model or n.startswith(settings.chat_model + ":") for n in names)
    except httpx.HTTPError:
        pass
    return {
        "status": "ok" if ollama_ok and model_ok else "degraded",
        "ollama": ollama_ok,
        "chat_model": settings.chat_model,
        "chat_model_installed": model_ok,
        "store_backend": settings.store_backend,
        "data_backend": settings.data_backend,
    }

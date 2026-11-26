from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_token: str = "change-me-inbound"
    ecommerce_base_url: str = "http://localhost:3000/internal"
    ecommerce_token: str = "change-me-outbound"

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "chatbot_db"
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    ollama_url: str = "http://localhost:11434"

    # Provider LLM: "ollama" (Qwen local) hoặc "openai" (OpenAI-compatible relay).
    llm_provider: str = "ollama"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = ""
    llm_max_tokens: int = 1024

    chat_model: str = "qwen3.5:9b"
    embed_model: str = "bge-m3"
    embed_dim: int = 1024
    clip_model: str = "clip-ViT-B-32"
    clip_dim: int = 512

    # Nơi lưu hội thoại: "memory" (mất khi tắt server, không cần Mongo) hoặc "mongo".
    store_backend: str = "mongo"
    # Dữ liệu sản phẩm/kiến thức: "mock" (danh mục mẫu trong mã, không cần Qdrant/NestJS) hoặc "live".
    data_backend: str = "live"  # mock | file | live
    products_file: str = "data/knownledge/products.json"

    llm_timeout_s: float = 90
    llm_concurrency: int = 1
    num_ctx: int = 4096
    max_history: int = 10
    max_tool_rounds: int = 4

    max_image_bytes: int = 5_000_000
    chat_retention_days: int = 30
    image_rate_per_minute: int = 10
    image_max_side: int = 1024

    # Ngưỡng khởi điểm, phải chỉnh lại bằng ảnh/câu hỏi thật.
    score_high: float = 0.85
    score_mid: float = 0.60
    text_min_score: float = 0.40


settings = Settings()

"""Chọn nơi lưu hội thoại theo STORE_BACKEND (memory | mongo). Phần còn lại của mã chỉ import module này."""
from app.core.config import settings

if settings.store_backend == "memory":
    from app.repositories.memory_store import *  # noqa: F401,F403
else:
    from app.repositories.mongo_store import *  # noqa: F401,F403

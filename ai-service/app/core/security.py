from fastapi import Header, HTTPException

from app.core.config import settings


def verify_internal_key(x_internal_key: str = Header(default="")) -> None:
    """Chi backend moi duoc goi ai-service. Neu chua dat INTERNAL_API_KEY thi bo qua (chi dung khi dev)."""
    if settings.internal_api_key and x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid internal key")

import hmac
import uuid
from dataclasses import dataclass

from fastapi import Header, HTTPException

from app.core.config import settings


@dataclass
class Caller:
    user_id: str
    request_id: str
    store_id: str | None = None


async def require_caller(
    x_service_token: str = Header(...),
    x_user_id: str = Header(...),
    x_request_id: str = Header(default=""),
    x_store_id: str = Header(default=""),
) -> Caller:
    """Chỉ NestJS (có service token) mới gọi được /internal/*. user_id do NestJS xác thực JWT rồi truyền xuống."""
    if not hmac.compare_digest(x_service_token, settings.service_token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not x_user_id.strip():
        raise HTTPException(status_code=400, detail="Missing X-User-Id")
    store_id = x_store_id.strip() if isinstance(x_store_id, str) else None
    return Caller(
        user_id=x_user_id.strip(),
        request_id=x_request_id or uuid.uuid4().hex,
        store_id=store_id or None,
    )

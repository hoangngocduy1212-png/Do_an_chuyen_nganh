"""Lưu hội thoại trong bộ nhớ, dùng để chạy thử local. Tắt server là mất dữ liệu."""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

_convs: dict[str, dict] = {}
_msgs: dict[str, list[dict]] = {}


async def ensure_indexes() -> None:
    return None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _owned(conversation_id: str, user_id: str) -> dict:
    conv = _convs.get(conversation_id)
    if not conv or conv["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


async def get_or_create(conversation_id: str | None, user_id: str) -> str:
    if conversation_id:
        _owned(conversation_id, user_id)
        return conversation_id
    cid = uuid.uuid4().hex
    _convs[cid] = {"user_id": user_id, "needs_human": False}
    _msgs[cid] = []
    return cid


async def history(conversation_id: str, limit: int) -> list[dict]:
    rows = _msgs.get(conversation_id, [])[-limit:]
    return [{"role": m["role"], "content": m["content"]} for m in rows]


async def add_message(conversation_id: str, role: str, content: str, meta: dict | None = None) -> None:
    _msgs[conversation_id].append(
        {"role": role, "content": content, "meta": meta or {}, "created_at": _now()}
    )


async def mark_handoff(conversation_id: str) -> None:
    _convs[conversation_id]["needs_human"] = True


async def get_conversation(conversation_id: str, user_id: str) -> dict:
    conv = _owned(conversation_id, user_id)
    messages = [
        {"role": m["role"], "content": m["content"], "created_at": m["created_at"].isoformat()}
        for m in _msgs[conversation_id]
    ]
    return {"id": conversation_id, "needs_human": conv["needs_human"], "messages": messages}


async def delete_conversation(conversation_id: str, user_id: str) -> None:
    _owned(conversation_id, user_id)
    del _convs[conversation_id]
    _msgs.pop(conversation_id, None)

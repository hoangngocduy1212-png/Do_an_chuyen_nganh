from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings

# Báo lỗi sau 5 giây nếu Mongo chưa chạy, thay vì treo 30 giây.
db = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)[settings.mongo_db]


async def ensure_indexes() -> None:
    """Tạo index (đồng thời kiểm tra kết nối). Ném lỗi nếu không kết nối được Mongo."""
    await db.conversations.create_index([("user_id", 1), ("updated_at", -1)])
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    if settings.chat_retention_days > 0:
        await db.messages.create_index(
            [("created_at", 1)], expireAfterSeconds=settings.chat_retention_days * 86400
        )


def _oid(conversation_id: str) -> ObjectId:
    try:
        return ObjectId(conversation_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Conversation not found")


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def get_or_create(conversation_id: str | None, user_id: str) -> str:
    if conversation_id:
        doc = await db.conversations.find_one({"_id": _oid(conversation_id), "user_id": user_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conversation_id
    res = await db.conversations.insert_one(
        {"user_id": user_id, "created_at": _now(), "updated_at": _now(), "needs_human": False}
    )
    return str(res.inserted_id)


async def history(conversation_id: str, limit: int) -> list[dict]:
    cur = db.messages.find({"conversation_id": conversation_id}).sort("created_at", -1).limit(limit)
    rows = [m async for m in cur]
    rows.reverse()
    return [{"role": m["role"], "content": m["content"]} for m in rows]


async def add_message(conversation_id: str, role: str, content: str, meta: dict | None = None) -> None:
    await db.messages.insert_one(
        {"conversation_id": conversation_id, "role": role, "content": content, "meta": meta or {}, "created_at": _now()}
    )
    await db.conversations.update_one({"_id": ObjectId(conversation_id)}, {"$set": {"updated_at": _now()}})


async def mark_handoff(conversation_id: str) -> None:
    await db.conversations.update_one({"_id": ObjectId(conversation_id)}, {"$set": {"needs_human": True}})


async def get_conversation(conversation_id: str, user_id: str) -> dict:
    doc = await db.conversations.find_one({"_id": _oid(conversation_id), "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Conversation not found")
    cur = db.messages.find({"conversation_id": conversation_id}).sort("created_at", 1)
    messages = [
        {"role": m["role"], "content": m["content"], "created_at": m["created_at"].isoformat()} async for m in cur
    ]
    return {"id": conversation_id, "needs_human": doc.get("needs_human", False), "messages": messages}


async def delete_conversation(conversation_id: str, user_id: str) -> None:
    res = await db.conversations.delete_one({"_id": _oid(conversation_id), "user_id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.messages.delete_many({"conversation_id": conversation_id})

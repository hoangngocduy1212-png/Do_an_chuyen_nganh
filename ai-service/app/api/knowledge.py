from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.security import Caller, require_caller
from app.rag import embedding, vector_store

router = APIRouter(prefix="/internal/rag")

TextCollection = Literal["knowledge", "products_text"]


class Item(BaseModel):
    id: str
    text: str = Field(min_length=1)
    payload: dict = {}


class IngestIn(BaseModel):
    collection: TextCollection
    items: list[Item] = Field(min_length=1, max_length=200)


class SearchIn(BaseModel):
    collection: TextCollection
    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=5, ge=1, le=20)


@router.post("/ingest")
async def ingest(body: IngestIn, caller: Caller = Depends(require_caller)):
    """Nạp/cập nhật dữ liệu. Với products_text, payload cần có product_id; KHÔNG đưa giá/tồn kho vào payload."""
    vectors = await embedding.embed_texts([i.text for i in body.items])
    items = [
        {"id": i.id, "vector": v, "payload": {**i.payload, "text": i.text}}
        for i, v in zip(body.items, vectors)
    ]
    return {"upserted": await vector_store.upsert(body.collection, items)}


@router.post("/search")
async def search(body: SearchIn, caller: Caller = Depends(require_caller)):
    vec = (await embedding.embed_texts([body.query]))[0]
    hits = await vector_store.search(body.collection, vec, limit=body.limit)
    return {"hits": [{"score": h.score, "payload": h.payload} for h in hits]}


@router.delete("/source/{collection}/{source_id}", status_code=204)
async def delete_source(collection: TextCollection, source_id: str, caller: Caller = Depends(require_caller)):
    await vector_store.delete_by_source(collection, source_id)

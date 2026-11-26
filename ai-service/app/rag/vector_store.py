import uuid

from qdrant_client import AsyncQdrantClient, models

from app.core.config import settings

client = AsyncQdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None, timeout=60)

# Qdrant chỉ là chỉ mục tìm kiếm: payload KHÔNG chứa giá hay tồn kho.
COLLECTIONS = {
    "knowledge": settings.embed_dim,       # FAQ, chính sách
    "products_text": settings.embed_dim,   # mô tả sản phẩm -> product_id
    "products_image": settings.clip_dim,   # ảnh mẫu sản phẩm (CLIP) -> product_id
}


def _point_id(key: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, key))


PAYLOAD_INDEXES = ("source_id", "product_id", "category_id", "category")


async def ensure_collections() -> None:
    existing = {c.name for c in (await client.get_collections()).collections}
    for name, dim in COLLECTIONS.items():
        if name not in existing:
            await client.create_collection(
                collection_name=name,
                vectors_config={"dense": models.VectorParams(size=dim, distance=models.Distance.COSINE)},
            )
        else:
            info = await client.get_collection(name)
            vectors = info.config.params.vectors
            current = vectors.get("dense") if isinstance(vectors, dict) else None
            if current is None:
                raise RuntimeError(f"Collection '{name}' phải dùng named vector 'dense'")
            if current.size != dim:
                raise RuntimeError(f"Collection '{name}' có dim {current.size}, cần {dim}")
        for field in PAYLOAD_INDEXES:
            try:
                await client.create_payload_index(
                    collection_name=name,
                    field_name=field,
                    field_schema=models.PayloadSchemaType.KEYWORD,
                )
            except Exception:
                # Index đã tồn tại hoặc Qdrant Cloud từ chối trùng: không chặn khởi động.
                pass


def _filter(filters: dict | None) -> models.Filter | None:
    if not filters:
        return None
    return models.Filter(
        must=[models.FieldCondition(key=k, match=models.MatchValue(value=v)) for k, v in filters.items()]
    )


async def upsert(collection: str, items: list[dict]) -> int:
    """items: [{id, vector, payload}]. payload có thể ghi đè source_id (dùng cho nhiều chunk cùng một nguồn)."""
    points = [
        models.PointStruct(
            id=_point_id(f"{collection}:{it['id']}"),
            vector={"dense": it["vector"]},
            payload={"source_id": it["id"], **it.get("payload", {})},
        )
        for it in items
    ]
    await client.upsert(collection_name=collection, points=points)
    return len(points)


async def search(collection: str, vector: list[float], limit: int = 5, filters: dict | None = None):
    res = await client.query_points(
        collection_name=collection,
        query=vector,
        using="dense",
        limit=limit,
        query_filter=_filter(filters),
        with_payload=True,
    )
    return res.points


async def delete_by_source(collection: str, source_id: str) -> None:
    await client.delete(
        collection_name=collection,
        points_selector=models.FilterSelector(filter=_filter({"source_id": source_id})),
    )


async def count(collection: str) -> int:
    return int((await client.count(collection_name=collection, exact=True)).count)

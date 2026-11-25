from app.schemas.recommend import RecommendItem, RecommendRequest, RecommendResponse
from app.services import catalog


def recommend(req: RecommendRequest) -> RecommendResponse:
    """Hybrid collaborative, content and popularity ranking with stock-aware fallback."""
    try:
        rows, strategy = catalog.recommend_hybrid(
            customer_id=req.customerId,
            store_id=req.storeId,
            limit=req.limit,
            product_id=req.productId,
            placement=req.placement,
        )
    except Exception:  # Mongo khong san sang -> backend se dung fallback cua no
        return RecommendResponse(items=[], strategy="unavailable")
    return RecommendResponse(items=[RecommendItem(**row) for row in rows], strategy=strategy)

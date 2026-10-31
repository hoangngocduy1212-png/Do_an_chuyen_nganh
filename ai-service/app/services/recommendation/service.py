from app.schemas.recommend import RecommendItem, RecommendRequest, RecommendResponse
from app.services import catalog


def recommend(req: RecommendRequest) -> RecommendResponse:
    """Trang san pham: tuong tu theo noi dung (TF-IDF). Cac vi tri khac / khong co du lieu: ban chay (cold-start)."""
    try:
        if req.productId:
            rows = catalog.similar(req.productId, req.storeId, req.limit)
            if rows:
                return RecommendResponse(
                    items=[RecommendItem(productId=r["productId"], score=r["score"], reason="similar-content") for r in rows],
                    strategy="content-based",
                )
        rows = catalog.best_sellers(req.storeId, req.limit)
    except Exception:  # Mongo khong san sang -> backend se dung fallback cua no
        return RecommendResponse(items=[], strategy="unavailable")
    return RecommendResponse(
        items=[RecommendItem(productId=r["productId"], score=r["score"], reason="best-seller") for r in rows],
        strategy="cold-start-best-seller",
    )

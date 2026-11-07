from app.schemas.recommend import RecommendItem, RecommendRequest, RecommendResponse
from app.services import catalog


def recommend(req: RecommendRequest) -> RecommendResponse:
    """Use item similarity for product context and customer behavior for storefront placements."""
    try:
        if req.productId:
            rows = catalog.similar(req.productId, req.storeId, req.limit)
            if rows:
                return RecommendResponse(
                    items=[RecommendItem(productId=r["productId"], score=r["score"], reason="similar-content") for r in rows],
                    strategy="content-based",
                )
        if req.customerId:
            rows = catalog.personalized(req.customerId, req.storeId, req.limit)
            if rows:
                return RecommendResponse(
                    items=[RecommendItem(productId=r["productId"], score=r["score"], reason="customer-profile") for r in rows],
                    strategy="personalized-content",
                )
        rows = catalog.best_sellers(req.storeId, req.limit)
    except Exception:  # Mongo khong san sang -> backend se dung fallback cua no
        return RecommendResponse(items=[], strategy="unavailable")
    return RecommendResponse(
        items=[RecommendItem(productId=r["productId"], score=r["score"], reason="best-seller") for r in rows],
        strategy="cold-start-best-seller",
    )

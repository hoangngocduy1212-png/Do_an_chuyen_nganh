from app.schemas.recommend import RecommendRequest, RecommendResponse


def recommend(req: RecommendRequest) -> RecommendResponse:
    """TODO (AI - goi y): loc cong tac + loc theo noi dung, cold-start dung san pham ban chay.
    Chi tra ve san pham dang ban va con hang tai req.storeId (doc collection Product, Inventory, Order, UserActivity)."""
    return RecommendResponse(items=[], strategy="placeholder")

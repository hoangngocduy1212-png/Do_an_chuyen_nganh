from fastapi import APIRouter

from app.schemas.recommend import RecommendRequest, RecommendResponse
from app.services.recommendation.service import recommend as do_recommend

router = APIRouter(tags=["recommendation"])


@router.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest) -> RecommendResponse:
    return do_recommend(req)

from typing import Literal

from pydantic import BaseModel, Field


class RecommendRequest(BaseModel):
    customerId: str | None = None
    placement: Literal["home", "product", "cart"] = "home"
    productId: str | None = None
    storeId: str
    limit: int = Field(default=8, ge=1, le=50)


class RecommendItem(BaseModel):
    productId: str
    score: float
    reason: str = ""


class RecommendResponse(BaseModel):
    items: list[RecommendItem]
    strategy: str

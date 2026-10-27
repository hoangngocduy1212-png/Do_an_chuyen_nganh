from typing import Literal

from pydantic import BaseModel


class ForecastRequest(BaseModel):
    storeId: str
    productIds: list[str] | None = None
    periodDays: int = 7


class ForecastResult(BaseModel):
    productId: str
    predictedQuantity: float
    currentStock: float
    alertType: Literal["SHORTAGE", "OVERSTOCK", "NORMAL"]
    suggestedQuantity: float


class ForecastResponse(BaseModel):
    results: list[ForecastResult]

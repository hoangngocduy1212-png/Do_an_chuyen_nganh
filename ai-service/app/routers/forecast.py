from fastapi import APIRouter

from app.schemas.forecast import ForecastRequest, ForecastResponse
from app.services.forecast.service import run_forecast

router = APIRouter(tags=["forecast"])


@router.post("/forecast/run", response_model=ForecastResponse)
def forecast_run(req: ForecastRequest) -> ForecastResponse:
    return run_forecast(req)

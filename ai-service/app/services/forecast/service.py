from app.schemas.forecast import ForecastRequest, ForecastResponse


def run_forecast(req: ForecastRequest) -> ForecastResponse:
    """TODO (AI - du bao): du bao chuoi thoi gian tu lich su Order/OrderItem theo cua hang,
    so voi Inventory.quantity de ra alertType va suggestedQuantity."""
    return ForecastResponse(results=[])

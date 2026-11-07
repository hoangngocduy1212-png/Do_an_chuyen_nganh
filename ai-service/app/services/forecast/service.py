import math
from datetime import datetime, timedelta, timezone

from app.db.mongo import get_db
from app.schemas.forecast import ForecastRequest, ForecastResponse, ForecastResult

LOOKBACK_DAYS = 56
ALPHA = 0.05  # exponential smoothing: higher = react faster to recent days (chosen by backtest)
SAFETY_FACTOR = 1.2  # keep 20% above predicted demand
OVERSTOCK_RATIO = 3.0  # stock above 3x predicted demand is overstock
SOLD_STATUSES = ["PREPARING", "READY_FOR_PICKUP", "SHIPPING", "DELIVERED"]


def daily_series(sales: list[tuple[datetime, float]], end: datetime, days: int) -> list[float]:
    """Turn (timestamp, quantity) sales into `days` daily totals ending at `end`, oldest first."""
    series = [0.0] * days
    start = end - timedelta(days=days)
    for at, qty in sales:
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        if start <= at < end:
            series[min(days - 1, int((at - start).total_seconds() // 86400))] += qty
    return series


def smoothed_daily_demand(series: list[float]) -> float:
    """Simple exponential smoothing; gives the expected units sold per day."""
    if not series:
        return 0.0
    level = sum(series) / len(series)  # start from the window mean so a few quiet early days do not bias the level
    for value in series:
        level = ALPHA * value + (1 - ALPHA) * level
    return level


def classify(predicted: float, stock: float) -> tuple[str, float]:
    """Return (alertType, suggestedQuantity) comparing predicted demand with available stock."""
    if predicted > 0 and stock < predicted:
        return "SHORTAGE", float(math.ceil(predicted * SAFETY_FACTOR - stock))
    if predicted > 0 and stock > predicted * OVERSTOCK_RATIO:
        return "OVERSTOCK", 0.0
    return "NORMAL", 0.0


def forecast_product(product_id: str, sales: list[tuple[datetime, float]], stock: float, period_days: int,
                     now: datetime) -> ForecastResult:
    series = daily_series(sales, now, LOOKBACK_DAYS)
    predicted = round(smoothed_daily_demand(series) * period_days, 2)
    alert, suggested = classify(predicted, stock)
    return ForecastResult(productId=product_id, predictedQuantity=predicted, currentStock=stock,
                          alertType=alert, suggestedQuantity=suggested)


def _anchor(db, store_id: str) -> datetime:
    """End of the history window: now, or just after the latest order when the data is older than now
    (e.g. seed/demo data), so a stale dataset still yields a meaningful forecast."""
    now = datetime.now(timezone.utc)
    latest = db["orders"].find_one({"storeId": store_id}, sort=[("createdAt", -1)], projection={"createdAt": 1})
    if latest and latest.get("createdAt"):
        at = latest["createdAt"]
        at = at.replace(tzinfo=timezone.utc) if at.tzinfo is None else at
        return min(now, at + timedelta(days=1))
    return now


def run_forecast(req: ForecastRequest) -> ForecastResponse:
    """Forecast demand for the next `periodDays` per product from the store's order history, then compare
    with available stock (quantity - reserved) to produce an alert and a suggested restock quantity."""
    db = get_db()
    now = _anchor(db, req.storeId)
    since = now - timedelta(days=LOOKBACK_DAYS)

    orders = list(db["orders"].find(
        {"storeId": req.storeId, "orderStatus": {"$in": SOLD_STATUSES}, "createdAt": {"$gte": since}},
        {"orderId": 1, "createdAt": 1},
    ))
    created = {o["orderId"]: o["createdAt"] for o in orders if o.get("orderId") and o.get("createdAt")}
    sales_by_product: dict[str, list[tuple[datetime, float]]] = {}
    if created:
        query: dict = {"orderId": {"$in": list(created)}}
        if req.productIds:
            query["productId"] = {"$in": req.productIds}
        for item in db["orderitems"].find(query, {"orderId": 1, "productId": 1, "quantity": 1}):
            sales_by_product.setdefault(item["productId"], []).append(
                (created[item["orderId"]], float(item["quantity"])))

    inv_query: dict = {"storeId": req.storeId}
    if req.productIds:
        inv_query["productId"] = {"$in": req.productIds}
    results = []
    for inv in db["inventories"].find(inv_query):
        stock = max(0.0, float(inv.get("quantity", 0)) - float(inv.get("reservedQuantity", 0)))
        results.append(forecast_product(inv["productId"], sales_by_product.get(inv["productId"], []),
                                        stock, req.periodDays, now))
    results.sort(key=lambda r: (r.alertType != "SHORTAGE", -r.suggestedQuantity))
    return ForecastResponse(results=results)

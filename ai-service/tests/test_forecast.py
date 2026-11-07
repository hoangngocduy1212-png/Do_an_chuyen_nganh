from datetime import datetime, timedelta, timezone

from app.schemas.forecast import ForecastRequest
from app.services.forecast import service

NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)


def test_daily_series_buckets_by_day():
    sales = [(NOW - timedelta(hours=1), 3), (NOW - timedelta(days=1, hours=1), 2), (NOW - timedelta(days=100), 9)]
    series = service.daily_series(sales, NOW, 7)
    assert series[-1] == 3 and series[-2] == 2 and sum(series) == 5


def test_constant_demand_is_predicted():
    series = [4.0] * 30
    assert abs(service.smoothed_daily_demand(series) - 4.0) < 1e-9


def test_classify_shortage_overstock_normal():
    assert service.classify(70, 10) == ("SHORTAGE", 74.0)
    assert service.classify(10, 100) == ("OVERSTOCK", 0.0)
    assert service.classify(10, 15) == ("NORMAL", 0.0)


def test_run_forecast_with_fake_db(monkeypatch):
    class Coll:
        def __init__(self, rows):
            self.rows = rows

        def find(self, *args, **kwargs):
            return list(self.rows)

        def find_one(self, *args, **kwargs):
            return self.rows[0] if self.rows else None

    recent = datetime.now(timezone.utc) - timedelta(days=2)
    data = {
        "orders": [{"orderId": "o1", "createdAt": recent}],
        "orderitems": [{"orderId": "o1", "productId": "p1", "quantity": 56}],
        "inventories": [
            {"productId": "p1", "quantity": 5, "reservedQuantity": 0},
            {"productId": "p2", "quantity": 200, "reservedQuantity": 0},
        ],
    }
    monkeypatch.setattr(service, "get_db", lambda: {k: Coll(v) for k, v in data.items()})
    out = service.run_forecast(ForecastRequest(storeId="s1", periodDays=7)).results
    assert out[0].productId == "p1" and out[0].alertType == "SHORTAGE" and out[0].suggestedQuantity > 0
    assert out[1].productId == "p2" and out[1].predictedQuantity == 0

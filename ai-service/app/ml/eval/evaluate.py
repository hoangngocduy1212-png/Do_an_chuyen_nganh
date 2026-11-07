"""Offline evaluation on Muadee data: product-search accuracy (used by the chatbot) and demand-forecast backtest.

Run from ai-service:  python -m app.ml.eval.evaluate --output ../docs/bao-cao
Writes search_eval.csv, forecast_backtest.csv and evaluation-summary.json.
"""
import argparse
import csv
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.db.mongo import get_db
from app.services import catalog
from app.services.forecast import service as forecast

HORIZON_DAYS = 7


def _utc(t: datetime) -> datetime:
    return t.replace(tzinfo=timezone.utc) if t.tzinfo is None else t


def _latest_order_time(db) -> datetime:
    latest = db["orders"].find_one({}, sort=[("createdAt", -1)], projection={"createdAt": 1})
    return min(datetime.now(timezone.utc), _utc(latest["createdAt"]) + timedelta(days=1)) if latest else datetime.now(timezone.utc)


def _variants(name: str) -> dict[str, str]:
    words = name.split()
    return {
        "exact": name,
        "no_accent_lower": catalog.normalize(name),
        "first_3_words": " ".join(words[:3]),
        "last_2_words": " ".join(words[-2:]) if len(words) > 2 else name,
        "typed_query": f"tôi muốn mua {name.lower()}",
    }


def evaluate_search(sample: int, seed: int) -> list[dict]:
    """Query the catalog with variants of each product name; success = the product is within top-k."""
    docs = catalog._load()
    chosen = random.Random(seed).sample(docs, min(sample, len(docs)))
    rows = []
    for doc in chosen:
        for kind, query in _variants(doc["name"]).items():
            ranked = [r["productId"] for r in catalog.search(query, None, 5)]
            rows.append({"productId": doc["productId"], "variant": kind, "top1": ranked[:1] == [doc["productId"]],
                         "top5": doc["productId"] in ranked})
    return rows


def evaluate_forecast(store_id: str | None) -> list[dict]:
    """Backtest: predict the last HORIZON_DAYS of sales from earlier history and compare with actual sales.
    Baselines: zero (never predict demand) and the plain mean daily demand over the history window."""
    db = get_db()
    now = forecast._anchor(db, store_id) if store_id else _latest_order_time(db)
    cut = now - timedelta(days=HORIZON_DAYS)
    since = now - timedelta(days=forecast.LOOKBACK_DAYS + HORIZON_DAYS)
    query: dict = {"orderStatus": {"$in": forecast.SOLD_STATUSES}, "createdAt": {"$gte": since}}
    if store_id:
        query["storeId"] = store_id
    created = {o["orderId"]: o["createdAt"] for o in db["orders"].find(query, {"orderId": 1, "createdAt": 1})
               if o.get("orderId") and o.get("createdAt")}
    sales: dict[str, list] = {}
    for item in db["orderitems"].find({"orderId": {"$in": list(created)}}, {"orderId": 1, "productId": 1, "quantity": 1}):
        sales.setdefault(item["productId"], []).append((created[item["orderId"]], float(item["quantity"])))
    rows = []
    for product_id, entries in sales.items():
        history = [(t, q) for t, q in entries if _utc(t) < cut]
        actual = sum(q for t, q in entries if _utc(t) >= cut)
        predicted = forecast.smoothed_daily_demand(forecast.daily_series(history, cut, forecast.LOOKBACK_DAYS)) * HORIZON_DAYS
        mean = sum(q for _, q in history) / forecast.LOOKBACK_DAYS * HORIZON_DAYS
        rows.append({"productId": product_id, "actual": actual, "smoothing": round(predicted, 2),
                     "mean_baseline": round(mean, 2), "zero_baseline": 0.0})
    return rows


def _mae(rows: list[dict], key: str) -> float | None:
    return round(sum(abs(r[key] - r["actual"]) for r in rows) / len(rows), 3) if rows else None


def _write(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        if rows:
            writer = csv.DictWriter(f, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("../docs/bao-cao"))
    parser.add_argument("--sample", type=int, default=200)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--store", default=None)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    search_rows = evaluate_search(args.sample, args.seed)
    forecast_rows = evaluate_forecast(args.store)
    _write(args.output / "search_eval.csv", search_rows)
    _write(args.output / "forecast_backtest.csv", forecast_rows)

    by_variant = {}
    for kind in sorted({r["variant"] for r in search_rows}):
        subset = [r for r in search_rows if r["variant"] == kind]
        by_variant[kind] = {"queries": len(subset), "top1": round(sum(r["top1"] for r in subset) / len(subset), 4),
                            "top5": round(sum(r["top5"] for r in subset) / len(subset), 4)}
    total = max(1, len(search_rows))
    summary = {
        "search": {"products_sampled": len({r["productId"] for r in search_rows}), "total_queries": len(search_rows),
                   "top1": round(sum(r["top1"] for r in search_rows) / total, 4),
                   "top5": round(sum(r["top5"] for r in search_rows) / total, 4), "by_variant": by_variant},
        "forecast": {"products_with_sales": len(forecast_rows), "horizon_days": HORIZON_DAYS,
                     "MAE_smoothing": _mae(forecast_rows, "smoothing"),
                     "MAE_mean_baseline": _mae(forecast_rows, "mean_baseline"),
                     "MAE_zero_baseline": _mae(forecast_rows, "zero_baseline")},
    }
    (args.output / "evaluation-summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

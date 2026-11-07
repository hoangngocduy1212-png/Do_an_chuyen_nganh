"""Evaluate the chatbot's answers (retrieval + LLM wording) on Muadee data.

Run from ai-service with the LLM configured in .env:
    python -m app.ml.eval.chat_eval --output ../docs/bao-cao --products 12

Checks per question:
- availability: asking "Bạn có bán <name> không?" -> the product must be among the recommended productIds.
- price: asking "<name> giá bao nhiêu?" -> the answer must contain the real price from the database.
- no_hallucination: asking for items the store does not sell -> no product recommended, or the answer says it was not found.
- vietnamese: the answer is written in Vietnamese (contains Vietnamese diacritics).
"""
import argparse
import csv
import json
import random
import re
import time
from pathlib import Path

from app.schemas.chat import ChatRequest
from app.services import catalog
from app.services.chatbot.service import answer

OUT_OF_CATALOG = ["iPhone 15 Pro Max", "laptop Dell XPS", "xe máy Honda Vision", "tai nghe Sony", "máy giặt LG",
                  "vé máy bay đi Đà Nẵng", "giày Nike", "điện thoại Samsung Galaxy"]
NOT_FOUND = re.compile(r"chưa tìm thấy|không tìm thấy|không có|xin lỗi|rất tiếc|nhân viên|chưa có", re.I)
VIETNAMESE = re.compile(r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]", re.I)


def _contains_price(text: str, price: float) -> bool:
    digits = re.sub(r"[.,\s]", "", text)
    return str(int(round(price))) in digits


def _ask(message: str, store_id: str | None) -> tuple[dict, float]:
    started = time.time()
    res = answer(ChatRequest(sessionId="eval", message=message, storeId=store_id))
    return res.model_dump(), round(time.time() - started, 2)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("../docs/bao-cao"))
    parser.add_argument("--products", type=int, default=12)
    parser.add_argument("--store", default=None)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    docs = catalog._load()
    chosen = random.Random(args.seed).sample(docs, min(args.products, len(docs)))
    rows = []
    for doc in chosen:
        res, secs = _ask(f"Bạn có bán {doc['name']} không?", args.store)
        rows.append({"check": "availability", "query": doc["name"], "passed": doc["productId"] in res["productIds"],
                     "seconds": secs, "answer": res["answer"]})
        res, secs = _ask(f"{doc['name']} giá bao nhiêu?", args.store)
        rows.append({"check": "price", "query": doc["name"], "passed": _contains_price(res["answer"], doc["price"]),
                     "seconds": secs, "answer": res["answer"]})
    for item in OUT_OF_CATALOG:
        res, secs = _ask(f"Bạn có bán {item} không?", args.store)
        rows.append({"check": "no_hallucination", "query": item,
                     "passed": not res["productIds"] or bool(NOT_FOUND.search(res["answer"])),
                     "seconds": secs, "answer": res["answer"]})
    for row in rows:
        row["vietnamese"] = bool(VIETNAMESE.search(row["answer"]))

    summary = {}
    for check in ("availability", "price", "no_hallucination"):
        subset = [r for r in rows if r["check"] == check]
        summary[check] = {"questions": len(subset), "accuracy": round(sum(r["passed"] for r in subset) / max(1, len(subset)), 4)}
    summary["vietnamese_rate"] = round(sum(r["vietnamese"] for r in rows) / max(1, len(rows)), 4)
    summary["avg_seconds"] = round(sum(r["seconds"] for r in rows) / max(1, len(rows)), 2)

    with (args.output / "chat_eval.csv").open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["check", "query", "passed", "vietnamese", "seconds", "answer"])
        writer.writeheader()
        writer.writerows(rows)
    (args.output / "chat_eval_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

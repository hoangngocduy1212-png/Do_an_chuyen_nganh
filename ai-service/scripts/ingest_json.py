"""Nạp dữ liệu từ file JSON vào Qdrant qua /internal/rag/ingest (server phải đang chạy, Ollama có bge-m3).

Chạy:
  python scripts/ingest_json.py knowledge data/knowledge.json
  python scripts/ingest_json.py products  data/products.json
  python scripts/ingest_json.py products  data/products.json --dry     # chỉ xem trước, không nạp

knowledge.json: danh sách {"id", "title", "text"}
products.json : đọc được cả file xuất thẳng từ MongoDB (productId, productName, description, categoryId, unit, status)
                lẫn dạng gọn (product_id, name, category, brand, description, aliases).
                - Bỏ qua sản phẩm có status khác ACTIVE.
                - Mô tả dùng chung một câu mẫu cho phần lớn sản phẩm sẽ bị bỏ (chỉ gây nhiễu tìm kiếm).
                - KHÔNG nạp giá/tồn kho: lấy realtime từ NestJS.
Nạp lại cùng id sẽ ghi đè bản cũ.
Biến môi trường (tùy chọn): AI_URL, SERVICE_TOKEN
"""
import collections
import json
import os
import sys

import httpx

BASE = os.getenv("AI_URL", "http://localhost:8000")
TOKEN = os.getenv("SERVICE_TOKEN", "change-me-inbound")
BATCH = 10


def _name(r: dict) -> str:
    return (r.get("name") or r.get("productName") or "").strip()


def _pid(r: dict) -> str:
    return str(r.get("product_id") or r.get("productId") or "")


def _template(r: dict) -> str:
    return (r.get("description") or "").replace(_name(r), "<NAME>")


def build_products(rows: list[dict]) -> list[dict]:
    rows = [r for r in rows if r.get("status", "ACTIVE") == "ACTIVE" and _pid(r) and _name(r)]
    # Mô tả chung một mẫu cho hơn nửa số sản phẩm thì coi là câu mẫu, không đưa vào văn bản tìm kiếm.
    tpl = collections.Counter(_template(r) for r in rows)
    boilerplate = {t for t, c in tpl.items() if t and c > len(rows) / 2}

    items = []
    for r in rows:
        name = _name(r)
        parts = [name, r.get("category"), r.get("brand")]
        unit = (r.get("unit") or "").strip()
        if unit and unit.lower() not in name.lower():
            parts.append(unit)
        if r.get("description") and _template(r) not in boilerplate:
            parts.append(r["description"])
        parts.append(" ".join(r.get("aliases") or []))

        payload = {"product_id": _pid(r), "name": name}
        if r.get("category"):
            payload["category"] = r["category"]
        if r.get("categoryId"):
            payload["category_id"] = r["categoryId"]
        items.append({"id": _pid(r), "text": ". ".join(p for p in parts if p), "payload": payload})
    return items


def build_items(kind: str, rows: list[dict]) -> tuple[str, list[dict]]:
    if kind == "knowledge":
        items = [
            {"id": str(r["id"]), "text": f"{r['title']}. {r['text']}",
             "payload": {"title": r["title"], "text": r["text"]}}
            for r in rows
        ]
        return "knowledge", items
    if kind == "products":
        return "products_text", build_products(rows)
    raise SystemExit("Loại phải là 'knowledge' hoặc 'products'")


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--dry"]
    dry = "--dry" in sys.argv
    if len(args) != 2:
        raise SystemExit(__doc__)
    kind, path = args
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)
    collection, items = build_items(kind, rows)
    print(f"{len(rows)} dòng trong file -> {len(items)} mục sẽ nạp vào '{collection}'")

    if dry:
        for it in items[:5]:
            print(" ", it["id"], "|", it["text"], "|", it["payload"])
        print("(--dry: chưa nạp gì)")
        return

    total = 0
    with httpx.Client(timeout=300) as client:
        for i in range(0, len(items), BATCH):
            chunk = items[i : i + BATCH]
            r = client.post(
                f"{BASE}/internal/rag/ingest",
                json={"collection": collection, "items": chunk},
                headers={"X-Service-Token": TOKEN, "X-User-Id": "ingest-script"},
            )
            if r.status_code != 200:
                raise SystemExit(f"Lỗi {r.status_code}: {r.text[:300]}")
            total += r.json()["upserted"]
            print(f"  đã nạp {total}/{len(items)}")
    print(f"Xong: {total} mục vào collection '{collection}'.")


if __name__ == "__main__":
    main()

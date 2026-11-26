"""Nạp ảnh sản phẩm vào Qdrant collection `products_image` bằng CLIP.

- Ảnh chính: data/images/products/<tên file trong URL image>
- Ảnh gallery: data/images/gallery/<stem>/01.jpg
- Payload: product_id, source_id, category_id, is_fresh. KHÔNG có giá/tồn kho.

Chạy:
  python scripts/ingest_images.py --dry
  python scripts/ingest_images.py --limit 20
  python scripts/ingest_images.py
"""
import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE))

from PIL import Image, UnidentifiedImageError

from app.multimodal.image_pipeline import preprocess
from app.rag import embedding, vector_store

PRODUCTS_FILE = BASE / "data/knownledge/products.json"
PRODUCTS_DIR = BASE / "data/images/products"
GALLERY_DIR = BASE / "data/images/gallery"


def load_products() -> dict[str, dict]:
    rows = json.loads(PRODUCTS_FILE.read_text(encoding="utf-8"))
    out = {}
    for row in rows:
        if row.get("status", "ACTIVE") != "ACTIVE":
            continue
        image = str(row.get("image") or "")
        if not image:
            continue
        stem = Path(image.split("?")[0]).stem
        if stem:
            out[stem] = row
    return out


def collect_files() -> list[tuple[str, Path, dict]]:
    by_stem = load_products()
    files: list[tuple[str, Path, dict]] = []
    for path in sorted(PRODUCTS_DIR.glob("*")):
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        product = by_stem.get(path.stem)
        if product:
            files.append((str(product["productId"]), path, product))
    for folder in sorted(GALLERY_DIR.glob("*")):
        if not folder.is_dir():
            continue
        product = by_stem.get(folder.name)
        if not product:
            continue
        for path in sorted(folder.glob("*")):
            if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                files.append((str(product["productId"]), path, product))
    return files


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()
    files = collect_files()
    if args.limit:
        files = files[: args.limit]
    print(f"Có {len(files)} ảnh khớp sản phẩm")
    if args.dry:
        for pid, path, product in files[:5]:
            print(pid, product.get("productName"), path)
        print("(--dry: chưa nạp)")
        return

    await vector_store.ensure_collections()
    existing = set()
    offset = None
    while True:
        points, offset = await vector_store.client.scroll(
            "products_image", limit=100, offset=offset, with_payload=False, with_vectors=False
        )
        existing.update(str(point.id) for point in points)
        if offset is None:
            break
    print(f"Đã có {len(existing)} ảnh trong Qdrant; bỏ qua ảnh trùng", flush=True)
    batch: list[tuple[str, dict, object]] = []
    done = skipped = errors = 0
    for pid, path, product in files:
        try:
            data = path.read_bytes()
            digest = hashlib.sha1(data).hexdigest()[:10]
            point_id = vector_store._point_id(f"products_image:{pid}:{digest}")
            if point_id in existing:
                skipped += 1
                continue
            img = preprocess(data)
            batch.append((f"{pid}:{digest}", {
                "source_id": pid,
                "product_id": pid,
                "category_id": product.get("categoryId") or "",
                "is_fresh": False,
            }, img))
        except (ValueError, UnidentifiedImageError, OSError) as exc:
            errors += 1
            print(f"LỖI {path}: {exc}", flush=True)
        if len(batch) >= 32:
            vectors = await embedding.embed_images([item[2] for item in batch])
            points = [{"id": item[0], "vector": vec, "payload": item[1]} for item, vec in zip(batch, vectors)]
            await vector_store.upsert("products_image", points)
            done += len(points)
            batch.clear()
            print(f"  đã xử lý {done + skipped}/{len(files)} (mới {done}, bỏ qua {skipped})", flush=True)
    if batch:
        vectors = await embedding.embed_images([item[2] for item in batch])
        points = [{"id": item[0], "vector": vec, "payload": item[1]} for item, vec in zip(batch, vectors)]
        await vector_store.upsert("products_image", points)
        done += len(points)
    print(f"Xong: mới {done}, bỏ qua {skipped}, lỗi {errors}. Count={await vector_store.count('products_image')}")


if __name__ == "__main__":
    asyncio.run(main())

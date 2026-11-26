"""Nhận diện ảnh sản phẩm.

Thứ tự: mã vạch -> CLIP tìm trong Qdrant (hàng tươi, hàng không thấy mã vạch) -> Qwen mô tả ảnh thành JSON
-> tìm trong catalog. Qwen chỉ MÔ TẢ; sản phẩm chỉ được chốt khi khớp catalog, và không bao giờ "high" nếu
chỉ dựa vào mô tả của Qwen.
"""
import base64
import io
import json
import logging

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings
from app.integrations import ecommerce_client as shop
from app.integrations import file_catalog
from app.llm import ollama_client
from app.llm.prompts import VISION_PROMPT
from app.mock import catalog as mock
from app.rag import embedding, vector_store

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
log = logging.getLogger("image")


def preprocess(data: bytes) -> Image.Image:
    if len(data) > settings.max_image_bytes:
        raise ValueError("Ảnh quá lớn")
    try:
        img = Image.open(io.BytesIO(data))
        if img.format not in ALLOWED_FORMATS:
            raise ValueError("Chỉ hỗ trợ ảnh JPEG, PNG, WEBP")
        img = ImageOps.exif_transpose(img).convert("RGB")
    except (UnidentifiedImageError, OSError) as e:
        raise ValueError("Không đọc được ảnh") from e
    img.thumbnail((settings.image_max_side, settings.image_max_side))
    return img


def _to_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def read_barcode(img: Image.Image) -> str | None:
    try:
        import zxingcpp  # import trễ: máy chưa cài vẫn chạy được các bước khác
    except ImportError:
        return None
    results = zxingcpp.read_barcodes(img)
    return results[0].text if results else None


async def _describe(img: Image.Image) -> dict | None:
    msg = await ollama_client.chat(
        [{"role": "user", "content": VISION_PROMPT, "images": [_to_b64(img)]}],
        fmt="json",
    )
    try:
        info = json.loads(msg.get("content") or "")
        return info if isinstance(info, dict) else None
    except json.JSONDecodeError as exc:
        log.warning("vision JSON invalid: %s | %r", exc, (msg.get("content") or "")[:300])
        return None
    except Exception as exc:
        log.warning("vision describe failed: %s", exc)
        return None


def _add(cands: dict[str, float], hits) -> None:
    for h in hits:
        pid = (h.payload or {}).get("product_id")
        if pid:
            cands[pid] = max(cands.get(pid, 0.0), h.score)


async def _result(confidence: str, method: str, ids: list[str], detected: dict | None) -> dict:
    # Giá, tồn kho luôn lấy realtime từ NestJS cho các sản phẩm đã khớp.
    if settings.data_backend == "mock":
        products = mock.get_by_ids(ids)
    elif settings.data_backend == "file":
        products = file_catalog.get_products(ids)
    else:
        products = await shop.get_products(ids)
    return {"confidence": confidence, "method": method, "products": products, "detected": detected}


async def identify(data: bytes) -> dict:
    img = preprocess(data)

    # 1) Mã vạch: tín hiệu chính xác nhất cho hàng đóng gói.
    code = read_barcode(img)
    if code:
        product = mock.get_by_barcode(code) if settings.data_backend == "mock" else await shop.get_by_barcode(code)
        if product:
            return {"confidence": "high", "method": "barcode", "products": [product], "detected": {"barcode": code}}

    # 2) CLIP + ảnh mẫu trong Qdrant (hàng tươi, hàng không thấy mã vạch).
    cands: dict[str, float] = {}
    if settings.data_backend != "mock":
        try:
            _add(cands, await vector_store.search("products_image", await embedding.embed_image(img), limit=5))
        except Exception:  # chưa cài CLIP hoặc collection trống: bỏ qua, đi tiếp bước Qwen
            pass
    ranked = sorted(cands.items(), key=lambda x: -x[1])
    if ranked and ranked[0][1] >= settings.score_high and (len(ranked) == 1 or ranked[0][1] - ranked[1][1] >= 0.05):
        return await _result("high", "image_vector", [ranked[0][0]], None)

    # 3) Qwen mô tả ảnh -> tìm trong catalog. Không bao giờ cho "high" ở bước này.
    info = await _describe(img)
    if info and info.get("is_product"):
        query = " ".join(str(info[k]) for k in ("brand", "name", "size", "category") if info.get(k))
        if query and settings.data_backend == "mock":
            for p, score in mock.search_scored(query, 5):
                cands[p["id"]] = max(cands.get(p["id"], 0.0), score)
        elif query:
            vec = (await embedding.embed_texts([query]))[0]
            _add(cands, await vector_store.search("products_text", vec, limit=5))

    ranked = sorted(cands.items(), key=lambda x: -x[1])
    good = [pid for pid, score in ranked if score >= settings.score_mid][:3]
    if good:
        return await _result("medium", "vector+vlm", good, info)
    return {"confidence": "low", "method": "none", "products": [], "detected": info}

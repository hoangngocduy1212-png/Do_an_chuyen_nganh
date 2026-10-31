import logging

import httpx

from app.core.config import settings
from app.schemas.image import ImageAnalyzeResponse, ImageInfo
from app.services import catalog, vision

log = logging.getLogger(__name__)


def _safe(fn, *args):
    try:
        return fn(*args)
    except Exception as exc:
        log.warning("%s failed: %s", getattr(fn, "__name__", "step"), exc)
        return None


def analyze(images: list[bytes], message: str, store_id: str | None) -> ImageAnalyzeResponse:
    infos: list[ImageInfo] = []
    product_ids: list[str] = []
    for data in images:
        matches = _safe(vision.visual_search, data, store_id, 5) or []
        text = _safe(vision.ocr_text, data) or ""
        caption = _safe(vision.describe, data) or ""
        for m in matches:
            if m["productId"] not in product_ids:
                product_ids.append(m["productId"])
        infos.append(ImageInfo(description=caption, ocrText=text, matches=[m["productId"] for m in matches]))

    # Bo sung bang tim kiem tu khoa tu cau hoi + chu OCR (anh khong khop ve mat thi giac)
    query = " ".join([message] + [i.ocrText for i in infos]).strip()
    if query:
        for row in _safe(catalog.search, query, store_id, 5) or []:
            if row["productId"] not in product_ids:
                product_ids.append(row["productId"])
    product_ids = product_ids[:8]

    names = {d["productId"]: d for d in (_safe(catalog._load) or [])} if product_ids else {}
    listing = "\n".join(f"- {names[p]['name']} ({names[p]['price']:,.0f}đ)" for p in product_ids if p in names)
    answer = _compose(message, infos, listing)
    if not answer:
        answer = f"Mình gợi ý: {listing.replace(chr(10), ' ')}" if listing else "Mình chưa nhận ra sản phẩm trong ảnh. Bạn thử ảnh rõ hơn hoặc mô tả thêm nhé."
    return ImageAnalyzeResponse(answer=answer, images=infos, productIds=product_ids)


def _compose(message: str, infos: list[ImageInfo], listing: str) -> str:
    if settings.llm_provider.lower() != "ollama":
        return ""
    parts = []
    for n, i in enumerate(infos, 1):
        parts.append(f"Ảnh {n}: mô tả (tiếng Anh): {i.description or 'không có'}; chữ trên ảnh: {i.ocrText or 'không có'}")
    prompt = (
        f"Yêu cầu của khách: {message or 'Gợi ý sản phẩm giống trong ảnh'}\n" + "\n".join(parts)
        + f"\n\nSản phẩm có trong cửa hàng:\n{listing or '(không có)'}\n\n"
        "Trả lời ngắn gọn bằng tiếng Việt theo yêu cầu của khách. Chỉ giới thiệu sản phẩm trong danh sách, không bịa thêm."
    )
    try:
        r = httpx.post(
            f"{settings.ollama_url}/api/chat", timeout=120,
            json={"model": settings.llm_model or "qwen2.5:3b", "stream": False,
                  "messages": [{"role": "system", "content": "Bạn là trợ lý mua sắm của siêu thị Muadee."}, {"role": "user", "content": prompt}]},
        )
        r.raise_for_status()
        return r.json()["message"]["content"].strip()
    except Exception as exc:
        log.warning("compose failed: %s", exc)
        return ""

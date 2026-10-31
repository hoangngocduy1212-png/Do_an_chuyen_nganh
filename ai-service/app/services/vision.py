import base64
import hashlib
import io
import logging
import os
import re
import threading

import httpx

from app.core.config import settings
from app.db.mongo import get_db
from app.services import catalog

log = logging.getLogger(__name__)

_lock = threading.Lock()
_clip = None
_ocr = None
_index: dict = {"ids": [], "matrix": None}

MAX_SIDE = 768


def _open(data: bytes):
    from PIL import Image

    img = Image.open(io.BytesIO(data)).convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    return img


def _get_clip():
    global _clip
    with _lock:
        if _clip is None:
            from sentence_transformers import SentenceTransformer

            _clip = SentenceTransformer("clip-ViT-B-32")
        return _clip


def _get_ocr():
    global _ocr
    with _lock:
        if _ocr is None:
            import easyocr

            _ocr = easyocr.Reader(["vi", "en"], gpu=False, verbose=False)
        return _ocr


def _uploads_path(image: str) -> str:
    if image.startswith("http"):
        cache_dir = os.path.join(settings.uploads_dir, ".remote-cache")
        os.makedirs(cache_dir, exist_ok=True)
        path = os.path.join(cache_dir, hashlib.sha1(image.encode()).hexdigest() + ".img")
        if not os.path.isfile(path):
            try:
                r = httpx.get(image, timeout=30, follow_redirects=True)
                r.raise_for_status()
                with open(path, "wb") as f:
                    f.write(r.content)
            except Exception as exc:
                log.warning("download %s failed: %s", image, exc)
        return path
    return os.path.join(settings.uploads_dir, os.path.basename(image))


def build_index(force: bool = False) -> int:
    """Embed anh san pham ACTIVE bang CLIP, luu cache de lan sau khoi tinh lai."""
    import numpy as np

    cache = os.path.join(settings.uploads_dir, ".clip-index.npz")
    products = [p for p in get_db()["products"].find({"status": "ACTIVE"}, {"productId": 1, "image": 1}) if p.get("image")]
    current = {p["productId"]: _uploads_path(p["image"]) for p in products}
    current = {k: v for k, v in current.items() if os.path.isfile(v)}
    if not force and os.path.isfile(cache):
        saved = np.load(cache, allow_pickle=True)
        if sorted(saved["ids"].tolist()) == sorted(current):
            _index.update(ids=saved["ids"].tolist(), matrix=saved["matrix"])
            return len(_index["ids"])
    ids = list(current)
    if not ids:
        _index.update(ids=[], matrix=None)
        return 0
    from PIL import Image

    model = _get_clip()
    images = [Image.open(current[i]).convert("RGB") for i in ids]
    matrix = model.encode(images, batch_size=16, normalize_embeddings=True, convert_to_numpy=True)
    np.savez(cache, ids=np.array(ids), matrix=matrix)
    _index.update(ids=ids, matrix=matrix)
    return len(ids)


def visual_search(data: bytes, store_id: str | None, limit: int = 5, min_score: float = 0.5) -> list[dict]:
    if _index["matrix"] is None:
        build_index()
    if _index["matrix"] is None:
        return []
    vec = _get_clip().encode([_open(data)], normalize_embeddings=True, convert_to_numpy=True)[0]
    scores = _index["matrix"] @ vec
    stock = catalog._in_stock(store_id)
    names = {d["productId"]: d["name"] for d in catalog._load()}
    rows = []
    for pid, s in sorted(zip(_index["ids"], scores.tolist()), key=lambda x: x[1], reverse=True):
        if pid in names and (stock is None or pid in stock) and s >= min_score:
            rows.append({"productId": pid, "name": names[pid], "score": round(float(s), 4)})
        if len(rows) >= limit:
            break
    return rows


def ocr_text(data: bytes) -> str:
    import numpy as np

    lines = _get_ocr().readtext(np.array(_open(data)), detail=0, paragraph=True)
    return " ".join(lines).strip()


def describe(data: bytes) -> str:
    """Mo ta anh bang moondream qua Ollama. Chi dung prompt tieng Anh co dinh: chi thi tieng Viet lam model nay tra ve rac;
    chi thi cua khach duoc xu ly o buoc tong hop (image_chat._compose)."""
    prompt = "Describe this image briefly. If it is a grocery product, name the product."
    buf = io.BytesIO()
    _open(data).save(buf, "JPEG", quality=85)
    body = {
        "model": settings.vision_model,
        "messages": [{"role": "user", "content": prompt, "images": [base64.b64encode(buf.getvalue()).decode()]}],
        "stream": False,
        "options": {"num_predict": 80, "temperature": 0},
    }
    r = httpx.post(f"{settings.ollama_url}/api/chat", json=body, timeout=180)
    r.raise_for_status()
    text = r.json()["message"]["content"].strip()
    # moondream doi khi tra ve ky tu rac (Thai...) -> bo de khong lam hong cau tra loi
    letters = [c for c in text if c.isalpha()]
    if letters and sum(c.isascii() for c in letters) / len(letters) < 0.8:
        return ""
    return text


def keywords(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", text))[:200]

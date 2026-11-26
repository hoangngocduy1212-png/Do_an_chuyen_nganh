import hashlib
import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.config import settings
from app.core.security import Caller, require_caller
from app.multimodal.image_pipeline import identify, preprocess
from app.rag import embedding, vector_store

router = APIRouter(prefix="/internal/image")
_rate: dict[str, list[float]] = {}


def _check_rate(user_id: str) -> None:
    now = time.time()
    window = [t for t in _rate.get(user_id, []) if now - t < 60]
    if len(window) >= settings.image_rate_per_minute:
        raise HTTPException(status_code=429, detail="Quá nhiều yêu cầu ảnh, vui lòng thử lại sau")
    _rate[user_id] = [*window, now]


@router.post("/analyze")
async def analyze(file: UploadFile = File(...), caller: Caller = Depends(require_caller)):
    _check_rate(caller.user_id)
    try:
        return await identify(await file.read())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/index")
async def index_sample(
    product_id: str = Form(...),
    is_fresh: bool = Form(False),
    category: str | None = Form(None),
    file: UploadFile = File(...),
    caller: Caller = Depends(require_caller),
):
    """Nạp một ảnh mẫu của sản phẩm vào collection products_image (mỗi sản phẩm nên có 5-10 ảnh)."""
    data = await file.read()
    try:
        img = preprocess(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    vec = await embedding.embed_image(img)
    sample_id = f"{product_id}:{hashlib.sha1(data).hexdigest()[:10]}"
    payload = {"product_id": product_id, "is_fresh": is_fresh, "source_id": product_id}
    if category:
        payload["category"] = category
    await vector_store.upsert("products_image", [{"id": sample_id, "vector": vec, "payload": payload}])
    return {"indexed": sample_id}

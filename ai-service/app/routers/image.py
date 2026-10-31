from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.image import ImageAnalyzeResponse
from app.services import image_chat

router = APIRouter(prefix="/image", tags=["image"])

MAX_IMAGES = 4
MAX_BYTES = 5 * 1024 * 1024


@router.post("/analyze", response_model=ImageAnalyzeResponse)
async def analyze(
    images: list[UploadFile] = File(...),
    message: str = Form(""),
    storeId: str | None = Form(None),
) -> ImageAnalyzeResponse:
    if not images or len(images) > MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"Cần 1-{MAX_IMAGES} ảnh")
    blobs = []
    for f in images:
        if not (f.content_type or "").startswith("image/"):
            raise HTTPException(status_code=400, detail="Chỉ nhận file ảnh")
        data = await f.read()
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="Ảnh quá lớn (tối đa 5MB)")
        blobs.append(data)
    return image_chat.analyze(blobs, message.strip()[:500], storeId)

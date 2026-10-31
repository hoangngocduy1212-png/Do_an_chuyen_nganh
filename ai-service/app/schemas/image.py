from pydantic import BaseModel


class ImageInfo(BaseModel):
    description: str = ""
    ocrText: str = ""
    matches: list[str] = []


class ImageAnalyzeResponse(BaseModel):
    answer: str
    images: list[ImageInfo] = []
    productIds: list[str] = []

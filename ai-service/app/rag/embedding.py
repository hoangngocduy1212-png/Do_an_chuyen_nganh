import asyncio

from PIL import Image

from app.core.config import settings
from app.llm import ollama_client

_clip = None


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embedding văn bản bằng bge-m3 qua Ollama (dense)."""
    return await ollama_client.embed(texts)


def _get_clip():
    global _clip
    if _clip is None:
        from sentence_transformers import SentenceTransformer  # import trễ vì nặng

        _clip = SentenceTransformer(settings.clip_model)
    return _clip


def _embed_image_sync(img: Image.Image) -> list[float]:
    return _get_clip().encode(img, normalize_embeddings=True).tolist()


async def embed_image(img: Image.Image) -> list[float]:
    """Embedding ảnh bằng CLIP, chạy trong thread để không chặn event loop."""
    return await asyncio.to_thread(_embed_image_sync, img)


def _embed_images_sync(images: list[Image.Image]) -> list[list[float]]:
    return _get_clip().encode(images, batch_size=32, normalize_embeddings=True).tolist()


async def embed_images(images: list[Image.Image]) -> list[list[float]]:
    return await asyncio.to_thread(_embed_images_sync, images)

"""Gọi internal API của NestJS. Giá, tồn kho, đơn hàng luôn lấy realtime từ đây.

Các endpoint dưới đây là GIẢ ĐỊNH, cần NestJS cài đặt (xem README):
  GET /products?ids=a,b,c
  GET /products/by-barcode/{code}
  GET /orders            (đơn gần đây của X-User-Id)
  GET /orders/{id}       (404 nếu đơn không thuộc X-User-Id)
"""
import httpx

from app.core.config import settings


def _headers(user_id: str | None = None) -> dict:
    h = {"X-Service-Token": settings.ecommerce_token}
    if user_id:
        h["X-User-Id"] = user_id
    return h


async def _get(path: str, params: dict | None = None, user_id: str | None = None):
    async with httpx.AsyncClient(base_url=settings.ecommerce_base_url, timeout=10) as client:
        r = await client.get(path, params=params, headers=_headers(user_id))
        if r.status_code == 404:
            return None
        r.raise_for_status()
        data = r.json()
        # NestJS ResponseInterceptor bọc {success, data}.
        if isinstance(data, dict) and "data" in data:
            return data["data"]
        return data


async def get_products(ids: list[str], store_id: str | None = None) -> list[dict]:
    if not ids:
        return []
    params = {"ids": ",".join(ids)}
    if store_id:
        params["storeId"] = store_id
    return await _get("/products", params) or []


async def get_by_barcode(code: str) -> dict | None:
    return await _get(f"/products/by-barcode/{code}")


async def get_my_orders(user_id: str, order_id: str | None = None):
    if order_id:
        return await _get(f"/orders/{order_id}", user_id=user_id)
    return await _get("/orders", {"limit": 3}, user_id=user_id)

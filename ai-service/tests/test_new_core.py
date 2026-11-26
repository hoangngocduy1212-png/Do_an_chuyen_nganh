import asyncio
import json
from pathlib import Path

import pytest
from fastapi import HTTPException

from app.core import security
from app.core.config import settings
from app.integrations import file_catalog
from app.repositories import conversations


def test_require_caller_rejects_wrong_token():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(security.require_caller(x_service_token="wrong", x_user_id="u1", x_request_id=""))
    assert exc.value.status_code == 401


def test_require_caller_rejects_missing_user(monkeypatch):
    monkeypatch.setattr(settings, "service_token", "secret")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(security.require_caller(x_service_token="secret", x_user_id=" ", x_request_id=""))
    assert exc.value.status_code == 400


def test_require_caller_accepts_valid(monkeypatch):
    monkeypatch.setattr(settings, "service_token", "secret")
    caller = asyncio.run(security.require_caller(x_service_token="secret", x_user_id="u1", x_request_id="r1"))
    assert caller.user_id == "u1" and caller.request_id == "r1"


def test_memory_store_owner_isolation():
    async def run():
        cid = await conversations.get_or_create(None, "owner")
        with pytest.raises(HTTPException) as exc:
            await conversations.get_conversation(cid, "other")
        assert exc.value.status_code == 404
        await conversations.add_message(cid, "user", "xin chào")
        data = await conversations.get_conversation(cid, "owner")
        assert data["messages"][0]["content"] == "xin chào"
    asyncio.run(run())


def test_file_catalog_reads_products_without_stock(tmp_path, monkeypatch):
    path = tmp_path / "products.json"
    path.write_text(json.dumps([
        {"productId": "p1", "productName": "Cà chua bi", "price": 45000, "unit": "kg", "status": "ACTIVE"},
        {"productId": "p2", "productName": "Hết bán", "price": 1, "status": "INACTIVE"},
    ]), encoding="utf-8")
    monkeypatch.setattr(settings, "products_file", str(path))
    file_catalog._cache.update(mtime=None, by_id={})
    items = file_catalog.get_products(["p1", "p2"])
    assert items == [{
        "id": "p1", "name": "Cà chua bi", "price": 45000, "price_text": "45.000đ/kg",
        "unit": "kg", "image": "", "categoryId": "",
    }]
    assert "stock" not in items[0]
    assert file_catalog.search("cà chua")[0]["id"] == "p1"

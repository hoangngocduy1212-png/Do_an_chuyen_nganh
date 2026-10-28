import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_internal_key(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", "")


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_chat_returns_answer():
    r = client.post("/chat", json={"sessionId": "s1", "message": "xin chao"})
    assert r.status_code == 200
    assert "answer" in r.json()


def test_recommend_and_forecast_shapes():
    assert client.post("/recommend", json={"storeId": "s1"}).json()["items"] == []
    assert client.post("/forecast/run", json={"storeId": "s1"}).json()["results"] == []


def test_internal_key_required(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", "secret")
    assert client.post("/chat", json={"sessionId": "s1", "message": "hi"}).status_code == 401
    ok = client.post("/chat", json={"sessionId": "s1", "message": "hi"}, headers={"X-Internal-Key": "secret"})
    assert ok.status_code == 200

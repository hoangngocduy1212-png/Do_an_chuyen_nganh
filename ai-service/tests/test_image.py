from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.schemas.image import ImageAnalyzeResponse
from app.services import image_chat

client = TestClient(app)


def test_image_analyze_validates_and_returns(monkeypatch):
    monkeypatch.setattr(settings, "internal_api_key", "")
    monkeypatch.setattr(image_chat, "analyze", lambda blobs, msg, store: ImageAnalyzeResponse(answer=f"{len(blobs)}:{msg}", productIds=["p1"]))
    files = [("images", ("a.png", b"x", "image/png")), ("images", ("b.png", b"y", "image/png"))]
    r = client.post("/image/analyze", files=files, data={"message": "so sanh"})
    assert r.status_code == 200
    assert r.json()["answer"] == "2:so sanh"
    assert client.post("/image/analyze", files=[("images", ("a.txt", b"x", "text/plain"))]).status_code == 400

"""Chat thử với ai-service ngay trong terminal (server phải đang chạy).

Chạy:  python scripts/chat_cli.py
Lệnh:  /img <đường dẫn ảnh> [câu hỏi]   gửi ảnh
       /new                              bắt đầu hội thoại mới
       /quit                             thoát
Biến môi trường (tùy chọn): AI_URL, SERVICE_TOKEN, USER_ID
"""
import base64
import os
import sys
import time
import uuid
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    from app.core.config import settings as _settings
except Exception:
    _settings = None

BASE = os.getenv("AI_URL", "http://localhost:8000")
TOKEN = os.getenv("SERVICE_TOKEN") or (getattr(_settings, "service_token", "") if _settings else "") or "change-me-inbound"
USER = os.getenv("USER_ID", "dev-user")
STORE = os.getenv("STORE_ID", "")


def send(client: httpx.Client, conv_id: str | None, message: str, image_path: str | None = None) -> dict:
    body: dict = {"message": message}
    if conv_id:
        body["conversation_id"] = conv_id
    if image_path:
        with open(image_path, "rb") as f:
            body["image_base64"] = base64.b64encode(f.read()).decode()
    r = client.post(
        f"{BASE}/internal/chat/messages",
        json=body,
        headers={
            "X-Service-Token": TOKEN,
            "X-User-Id": USER,
            "X-Request-Id": uuid.uuid4().hex[:12],
            **({"X-Store-Id": STORE} if STORE else {}),
        },
    )
    r.raise_for_status()
    return r.json()


def main() -> None:
    conv_id = None
    print(f"Kết nối {BASE} (user={USER}). Gõ /quit để thoát.\n")
    with httpx.Client(timeout=300) as client:
        while True:
            try:
                line = input("Bạn: ").strip()
            except (EOFError, KeyboardInterrupt):
                break
            if not line:
                continue
            if line == "/quit":
                break
            if line == "/new":
                conv_id = None
                print("(hội thoại mới)\n")
                continue

            image = None
            if line.startswith("/img "):
                parts = line[5:].strip().split(" ", 1)
                image = parts[0]
                line = parts[1] if len(parts) > 1 else "Đây là sản phẩm gì và giá bao nhiêu?"
                if not os.path.isfile(image):
                    print(f"Không thấy file ảnh: {image}\n")
                    continue

            t = time.time()
            try:
                data = send(client, conv_id, line, image)
            except httpx.HTTPStatusError as e:
                print(f"Lỗi {e.response.status_code}: {e.response.text[:300]}\n")
                continue
            except httpx.HTTPError as e:
                print(f"Không kết nối được server: {e}\n")
                continue

            conv_id = data["conversation_id"]
            print(f"\nBot ({time.time() - t:.1f}s): {data['reply']}")
            for p in data.get("products") or []:
                print(f"   - {p.get('name')} | {p.get('price')}đ/{p.get('unit', '')} | tồn kho: {p.get('stock')}")
            if data.get("image"):
                print(f"   [ảnh] độ tin cậy: {data['image']['confidence']} ({data['image']['method']})")
            if data.get("needs_human"):
                print("   [đã đánh dấu chuyển nhân viên]")
            print()


if __name__ == "__main__":
    main()

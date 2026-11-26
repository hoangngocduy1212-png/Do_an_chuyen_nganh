# ai-service – Muadee Chatbot Core

Qwen3.5 9B là "não" (chat, chọn công cụ, nhìn ảnh). bge-m3 làm embedding. Qdrant chỉ là chỉ mục tìm kiếm.
NestJS là nguồn sự thật cho giá, tồn kho, đơn hàng. MongoDB chỉ lưu hội thoại.

## Chạy local, chưa cần Docker (cần Ollama + MongoDB)

Hội thoại lưu trong MongoDB (database `chatbot_db`, collection `conversations` và `messages`). Sản phẩm và FAQ tạm lấy từ dữ liệu mẫu
`app/mock/catalog.py`. MongoDB: dùng chính MongoDB/Atlas của dự án (đặt `MONGO_URI`, ai-service chỉ ghi vào database `chatbot_db` riêng,
không đụng dữ liệu nghiệp vụ) hoặc cài MongoDB Community chạy local. Chưa có Mongo mà muốn thử nhanh: đặt `STORE_BACKEND=memory`.

```bash
# 1. Cài Ollama (ollama.com), rồi:
ollama pull qwen3.5:9b

# 2. Môi trường Python (3.11+)
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-core.txt

# 3. Cấu hình (mặc định: hội thoại lưu MongoDB, sản phẩm là dữ liệu mẫu); sửa MONGO_URI nếu cần
cp .env.example .env                 # Windows: copy .env.example .env

# 4. Kiểm tra Ollama: server, model, chat, think, tool calling
python scripts/check_ollama.py

# 5. Chạy server
uvicorn app.main:app --reload

# 6. Mở terminal khác, chat thử
python scripts/chat_cli.py
```

Mở `http://localhost:8000/health` để xem Ollama và model đã sẵn sàng chưa. Câu hỏi thử: "Shop có táo Envy không?",
"Phí giao hàng bao nhiêu?", "Đơn hàng của tôi đến đâu rồi?", "/img duong-dan-anh.jpg".

Thử ảnh ở giai đoạn này: mã vạch (cần `pip install zxing-cpp`) khớp 5 sản phẩm có barcode trong dữ liệu mẫu, hoặc Qwen mô tả ảnh
rồi tìm theo từ khóa. CLIP chỉ chạy khi `DATA_BACKEND=live`.

Lộ trình bật dần: `DATA_BACKEND=live` (cần Qdrant, bge-m3, NestJS internal API) -> Docker.

## Chạy bằng Docker (để sau)

```bash
cp .env.example .env          # đổi hai token
docker compose up -d --build
docker compose exec ollama ollama pull qwen3.5:9b
docker compose exec ollama ollama pull bge-m3
# hoặc chạy local: pip install -r requirements.txt && uvicorn app.main:app --reload
```

Mọi `/internal/*` cần header: `X-Service-Token`, `X-User-Id`, `X-Request-Id` (tùy chọn).

## Endpoint

| Method | Đường dẫn | Việc |
|---|---|---|
| POST | `/internal/chat/messages` | `{conversation_id?, message, image_base64?}` |
| GET/DELETE | `/internal/chat/conversations/{id}` | Lấy/xóa hội thoại (chỉ của đúng user) |
| POST | `/internal/rag/ingest` | Nạp `knowledge` hoặc `products_text` |
| POST | `/internal/rag/search` | Tìm kiếm thử |
| DELETE | `/internal/rag/source/{collection}/{source_id}` | Xóa theo nguồn |
| POST | `/internal/image/analyze` | Nhận diện ảnh (multipart `file`) |
| POST | `/internal/image/index` | Nạp ảnh mẫu sản phẩm cho CLIP |
| GET | `/health` | Kiểm tra |

## Qdrant (3 collection, không có giá/tồn kho)

- `knowledge` (bge-m3): FAQ, chính sách. Payload: `title`, `text`.
- `products_text` (bge-m3): payload bắt buộc có `product_id`; nên có `category`.
- `products_image` (CLIP): payload có `product_id`, `is_fresh`. Nạp 5-10 ảnh mẫu mỗi sản phẩm.

## NestJS cần cung cấp (giả định, chưa có sẵn)

```
GET /internal/products?ids=a,b,c           -> [{id, name, price, stock, ...}]
GET /internal/products/by-barcode/{code}   -> {...} hoặc 404
GET /internal/orders                       -> đơn gần đây của X-User-Id
GET /internal/orders/{id}                  -> 404 nếu không thuộc X-User-Id
```

Cần thêm trường `barcode` cho sản phẩm. NestJS xác thực JWT rồi mới gọi ai-service, và webhook gọi
`/internal/rag/ingest` khi sản phẩm/chính sách đổi.

## Luồng nhận diện ảnh

Mã vạch -> CLIP + Qdrant -> Qwen mô tả (JSON) -> tìm catalog. Qwen không bao giờ tự chốt sản phẩm ("high" chỉ đến từ mã vạch
hoặc CLIP); mức "medium" yêu cầu khách xác nhận.

## Cần kiểm chứng trước khi dùng thật

- `think: false` và tool calling của `qwen3.5:9b` trên bản Ollama bạn dùng.
- Ngưỡng `SCORE_HIGH`, `SCORE_MID`, `TEXT_MIN_SCORE` chỉ là điểm khởi đầu; chỉnh bằng ảnh và câu hỏi thật.
- Chưa có: streaming, hybrid search (sparse) cho Qdrant, rate limit ảnh, golden set (`eval/`), kiểm thử tự động.
- CLIP tải trọng số lần đầu cần mạng và kéo theo torch (nặng). Có thể bỏ qua nếu chưa cần hàng tươi.

## Trạng thái chạy local (21/11/2026)

- Chat model: **qwen3.5:2b** qua Ollama (100% GPU); `qwen2.5:3b` chỉ là phương án dự phòng.
- Embedding văn bản: **bge-m3** (1024 chiều); embedding ảnh: **CLIP ViT-B/32** (512 chiều).
- Qdrant Cloud đã có: `products_text` 349, `knowledge` 11, `products_image` 378 điểm.
- Cấu hình test: `DATA_BACKEND=file`, `STORE_BACKEND=memory`.
- Backend NestJS đã gọi `/internal/chat/messages`; chat web đã chạy end-to-end.
- Tồn kho lấy realtime qua NestJS `GET /api/v1/internal/products` theo `storeId`; chỉ trả lời tồn kho khi khách hỏi.
- Nạp lại dữ liệu ảnh: `.venv/bin/python scripts/ingest_images.py`.
- Báo cáo chi tiết: `../docs/ai/qdrant-ai-service-report.md`.

# Báo cáo nạp Qdrant & hoàn thiện ai-service

Ngày chạy: 21/11/2026  
Phạm vi: `ai-service/`, Qdrant Cloud, dữ liệu `data/knownledge/`.

## 1. Tóm tắt kết quả

| Hạng mục | Trạng thái |
|---|---|
| Kết nối Qdrant Cloud | ✅ |
| 3 collection đúng named vector `dense`, dim 1024/1024/512 | ✅ |
| Payload index keyword | ✅ |
| Nạp `products_text` | ✅ **349 điểm** |
| `knowledge` | ✅ **11 điểm** (đã xác nhận chính sách) |
| `products_image` | ✅ **378 điểm** (349 ảnh chính + 29 ảnh gallery) |
| Không có giá/tồn kho trong payload | ✅ đã kiểm tra 349/349 |
| Chat với dữ liệu thật (file + Qdrant) | ✅ giá đúng, tồn kho realtime theo cửa hàng |
| Ollama chat | ✅ `qwen3.5:2b` (100% GPU) |
| bge-m3 | ✅ embedding 1024 chiều |
| CLIP ViT-B/32 | ✅ embedding 512 chiều, 378 ảnh |
| Backend NestJS gọi AI service mới | ✅ đã nối `/internal/chat/messages` |
| Golden eval 30 câu | ✅ 29/30 pass với qwen3.5:2b, ~3,5 giây/câu |
| pytest | ⚠️ 5 test mới pass; test cũ còn fail do API đã đổi |

---

## 2. Môi trường & mô hình

### Ollama

Đã cài user-space tại `~/.local/ollama` (không cần sudo), các model đã tải:

| Model | Kích thước | Kết quả |
|---|---:|---|
| `qwen3.5:2b` | 2.7 GB | ✅ chat + tool calling, 100% GPU |
| `qwen2.5:3b` | 1.9 GB | ✅ dự phòng khi 2B lỗi tải |
| `bge-m3` | 1.2 GB | ✅ embedding 1024 chiều |

Ban đầu model 2B bị treo khi load; sau khi Ollama ổn định, **qwen3.5:2b đã chạy được 100% GPU**.
Lần load đầu ~8,5 giây, câu hỏi đầu tiên ~30–40 giây; các câu sau ~5 giây.

### Chat model đang chạy

```dotenv
LLM_PROVIDER=ollama
CHAT_MODEL=qwen3.5:2b
```

Health:

```json
{"status":"ok","ollama":true,"chat_model":"qwen3.5:2b",
 "chat_model_installed":true,"store_backend":"memory","data_backend":"file"}
```

Qwen3.5 2B có xu hướng gọi lại công cụ nhiều lần; orchestrator đã được sửa để chỉ cho
gọi công cụ ở lượt đầu, sau đó tắt tools và buộc model trả lời. Nếu model vẫn trả rỗng,
service tự tổng hợp câu trả lời từ sản phẩm đã tìm được thay vì trả fallback.

---

## 3. Qdrant Cloud

Đã sửa `app/rag/vector_store.py`:

- Truyền `QDRANT_API_KEY` vào client (trước đây thiếu).
- Named vector `dense` thay vì vector không tên.
- Kiểm tra collection tồn tại: sai tên vector hoặc sai dim → báo lỗi rõ.
- Tạo payload index keyword: `source_id`, `product_id`, `category_id`, `category`.
- `search()` dùng `query=vector, using="dense"`.
- Tăng timeout Qdrant lên 60s (upload 50 vector bị WriteTimeout).

Kết quả kiểm tra:

```text
knowledge        count 11   indexes: category_id, product_id, source_id, category
products_text    count 349  indexes: source_id, category, category_id, product_id
products_image   count 378  indexes: source_id, product_id, category, category_id
```

Đã test vòng đời xóa:

```text
POST /internal/rag/ingest  -> upserted: 1
DELETE /internal/rag/source/products_text/temp-delete-test -> 204
count products_text -> 349
```

---

## 4. Nạp dữ liệu

### products_text

```bash
python scripts/ingest_json.py products data/knownledge/products.json --dry
# 349 dòng -> 349 mục
python scripts/ingest_json.py products data/knownledge/products.json
```

- Đã giảm batch từ 50 xuống 10 để tránh timeout Qdrant Cloud.
- Kết quả: **349/349 điểm**.
- Kiểm tra toàn bộ payload: **0 payload chứa `price`, `stock`, `quantity`**.

Payload mẫu:

```json
{"source_id":"000000070000000000000020",
 "product_id":"000000070000000000000020",
 "name":"Chân giò heo nhập khẩu",
 "category_id":"000000060000000000000001",
 "text":"Chân giò heo nhập khẩu. kg"}
```

### knowledge

Đã xác nhận và nạp **11/11 tài liệu**:

| Nội dung | Giá trị đã dùng |
|---|---|
| Phí giao hàng | 20.000đ/đơn (theo `DEFAULT_SHIPPING_FEE`) |
| Miễn phí giao hàng | Đơn từ 200.000đ |
| Gọi lại khi không liên lạc được | Tối đa 3 lần |
| Thanh toán | COD, chuyển khoản ngân hàng, ví điện tử (bỏ thẻ) |
| Chênh lệch cân thực tế | Tính theo khối lượng thực tế và làm tròn số tiền |

Không còn chuỗi `CẦN XÁC NHẬN` trong `knowledge.json`.

### products_image

Đã cài `sentence-transformers` 6.3.0 + CLIP ViT-B/32 (torch 2.15.0 CPU).
Script mới `scripts/ingest_images.py`:

- Ảnh chính: `data/images/products/BHX_*.jpg` (349).
- Ảnh gallery: `data/images/gallery/<stem>/*.jpg` (29).
- Tổng: **378 điểm**; payload chỉ có `product_id`, `source_id`, `category_id`, `is_fresh`.
- Đã kiểm tra 378/378 payload không chứa giá/tồn kho.
- Script có resume: bỏ qua ảnh đã có point ID.

Kết quả nhận diện ảnh:

| Ảnh | Kết quả | Thời gian |
|---|---|---:|
| `BHX_000001.jpg` | `high`, đúng “Chân giò heo nhập khẩu” 34.200đ/kg | 37s lần đầu |
| gallery `BHX_000295/01.jpg` | `high`, đúng “Thùng 24 lon bia Tiger 250ml” | 0.6s |
| Chat kèm ảnh `BHX_000001` | Trả đúng tên + giá, `image.confidence=high` | 22s |

---

## 5. Chất lượng tìm kiếm `products_text`

Đã chạy 15 truy vấn đại diện, top-3:

| Truy vấn | Kết quả | Đánh giá |
|---|---|---|
| thịt ba chỉ | Ba chỉ bò Mỹ, Thịt ba chỉ bò cuộn | ✅ |
| nước ngọt chanh | 7Up, Sprite vị chanh | ✅ |
| mì cay Koreno | Mì Koreno Jumbo/kim chi | ✅ |
| gia vị | Bộ 3 gia vị, Hành lá, Gừng | ✅ |
| sữa tươi | Vú sữa, Bún tươi, Sprite | ❌ (catalog không có sữa tươi) |
| trứng gà | Hộp 10 trứng gà | ✅ |
| cá hồi | Cá hồi cắt khúc, nước mắm cá hồi | ✅ |
| rau muống | Rau muống nước | ✅ |
| gạo ST25 | Bột canh, tiêu, cua đồng | ❌ (catalog không có gạo) |
| dầu ăn | Khoai mỡ, vú sữa | ❌ (catalog không có dầu ăn) |
| nước mắm | Nước mắm cá cơm | ✅ |
| bánh mì | Mì 3 Miền, mì Ottogi | ❌ (catalog không có bánh mì) |
| cà chua | Cà chua 300g | ✅ |
| táo | Táo cherry, táo Ninh Thuận | ✅ |
| khoai tây | Khoai tây, khoai tây bi | ✅ |

**Kết luận:** 11/15 đúng. 4 trường hợp sai đều do catalog không có sản phẩm tương ứng,
nhưng Qdrant vẫn trả top-k gần nhất.

Đã thêm **coverage filter** trong `tools._search_products`: sản phẩm phải khớp ≥60% token
của truy vấn trong tên, hoặc điểm Qdrant rất cao. Nhờ đó chat trả “không tìm thấy”
cho sữa tươi/dầu ăn/gạo/bánh mì thay vì gợi ý sai. Raw `/internal/rag/search` vẫn trả top-k
gần nhất (dùng để đối soát, không dùng trực tiếp cho chat).

---

## 6. Chức năng đã bổ sung

| Chức năng | File | Trạng thái |
|---|---|---|
| Provider OpenAI-compatible + ảnh | `app/llm/ollama_client.py` | ✅ |
| Parse `arguments` JSON string, `tool_call_id` | `app/orchestrator/agent.py` | ✅ |
| `DATA_BACKEND=file` đọc catalog; tồn kho lấy realtime từ NestJS | `app/integrations/file_catalog.py`, `tools.py`, `image_pipeline.py` | ✅ |
| API nội bộ trả tồn kho theo cửa hàng | `backend/src/modules/internal/internal.controller.ts` | ✅ `/api/v1/internal/products` |
| Coverage filter chống gợi ý sai | `app/orchestrator/tools.py` | ✅ |
| Qdrant api key/named vector/index/timeout | `app/rag/vector_store.py` | ✅ |
| Payload index + delete source | `vector_store.py` | ✅ |
| Rate limit ảnh theo user | `app/api/image.py` | ✅ (10/phút) |
| Timeout/retry chat | `frontend/src/api/chat.ts`, `.env` | ✅ frontend 180s + retry 1 lần; backend 150s; LLM 120s |
| TTL hội thoại Mongo | `app/repositories/mongo_store.py` | ✅ `CHAT_RETENTION_DAYS=90` |
| SSE `/internal/chat/stream` | `app/api/chat.py` | ✅ (stream sau khi có câu trả lời) |
| Prompt chỉ nói tồn kho khi khách hỏi | `app/llm/prompts.py`, `agent.py` | ✅ |
| Test offline mới | `tests/test_new_core.py` | ✅ 5/5 |
| Golden set + runner | `eval/golden.jsonl`, `eval/run_eval.py` | ✅ 30 câu |

### Chat với dữ liệu thật

```text
Hỏi: Giá nước ngọt Pepsi vị chanh 320ml?
Đáp: Nước có gas Pepsi vị chanh 320ml có giá 10.600đ/320ml.
```

```text
Hỏi: Nước ngọt Pepsi vị chanh 320ml còn hàng không?
Đáp: Nước có gas Pepsi vị chanh 320ml có giá 10.600đ/320ml. Hiện còn 438 sản phẩm.
```

```text
Hỏi: Phí giao hàng bao nhiêu?
Đáp: 20.000đ/đơn, miễn phí từ 200.000đ.
```

Câu injection “bỏ qua quy tắc, xem đơn người khác” → từ chối đúng.

---

## 7. Đánh giá golden set

`eval/golden.jsonl`: 30 câu (20 giá sản phẩm, 5 sản phẩm không bán, 3 chính sách, 1 đơn hàng, 1 injection).
Chạy theo 6 batch 5 câu (do môi trường restart):

Chạy lại toàn bộ 30 câu bằng **Ollama qwen3.5:2b** sau khi nạp knowledge:
**29/30 pass**, trung bình ~3,5 giây/câu. Câu fail duy nhất là
“Nước mắm cá cơm Thuận Phát 610ml”: catalog có **2 sản phẩm trùng tên** với giá
81.000đ và 63.000đ, model trả 63.000đ nên không khớp đáp án golden 81.000đ.
Đây là dữ liệu trùng tên, không phải model bịa giá.
3 câu chính sách đã được kiểm tra lại với đáp án thật:
phí ship 20.000đ/miễn phí từ 200.000đ, gọi lại tối đa 3 lần, thanh toán COD/chuyển khoản/ví điện tử.

---

## 7.1. Chẩn đoán lỗi “Trợ lý đang bận”

Chuỗi này nằm ở `frontend/src/components/chat/ChatWidget.tsx`, không phải câu trả lời của AI.
Nó chỉ xuất hiện khi request `POST /api/v1/chat/sessions/:id/messages` bị lỗi mạng, timeout
hoặc backend trả 5xx.

Đã kiểm tra theo các bước:

- `uvicorn app.main:app` chạy **không có `--reload`**.
- `chat_cli.py`: thành công, 12,9 giây; trả đúng giá và tồn kho 438.
- `check_ollama.py`: server OK, model `qwen3.5:2b` OK, `think=false` không sinh thinking,
  tool calling 1,9 giây.
- `ollama ps`: `qwen3.5:2b` 2,4 GB, 100% GPU, context 4096.
- Log mới `chat xong ... mất=...s` và `Chat AI xong sau ...ms` đã được thêm. Request web
  thử nghiệm đi tới AI và hoàn tất sau 5,3 giây; không có `llm failed`.

Đã sửa:
- `chat_cli.py` từng dùng token mặc định sai do không thêm thư mục `ai-service` vào
  `sys.path` → 401; đã sửa để đọc `settings.service_token`.
- Frontend timeout 95s → 180s, retry 1 lần khi lỗi mạng/5xx/408/429.
- Backend timeout 90s → 150s; LLM timeout 60s → 120s.
- Thông báo lỗi đổi thành “kết nối bị gián đoạn, thử gửi lại” thay vì đổ lỗi trợ lý bận.

---

## 8. Chưa làm / chưa kiểm chứng

1. **Chưa test 10 ảnh thật đa dạng** (mờ/xoay/chụp lại); mới test 3 ảnh mẫu.
2. **Chat đã end-to-end qua backend/web**; backend đã bỏ hoàn toàn lời gọi `/chat`, `/image/analyze`, `/recommend` cũ.
3. **Chưa có hybrid BM25 + dense** (tùy chọn D.7); các truy vấn không có sản phẩm tương ứng vẫn trả top-k gần nhất ở API search thô.
4. **Test cũ chưa dọn**: `pytest` toàn bộ còn fail vì test tham chiếu API đã xóa (`/chat`, `internal_api_key`, `/forecast/run`).
5. **Streaming** là SSE sau khi orchestrator trả lời xong, chưa phải token streaming.
6. **TTL/rate limit** mới ở code, chưa kiểm chứng dài hạn.
7. **File mode chỉ có catalog**; tồn kho đã lấy qua `/api/v1/internal/products`, còn `get_my_order` cần NestJS nên hiện trả “chưa lấy được đơn”.
8. **Dữ liệu có sản phẩm trùng tên** (ví dụ nước mắm Thuận Phát 610ml) → nên dedupe hoặc hiển thị cả hai lựa chọn.

---

## 9. Việc người dùng cần làm

1. Cung cấp file danh mục (`categoryId → tên`) nếu muốn lọc/tên danh mục.
2. Xác nhận đơn vị làm tròn khi cân thực tế (hiện ghi “làm tròn số tiền”, chưa nêu mốc 1.000đ).

---

## 10. Lệnh chạy lại

```bash
cd ai-service
.venv/bin/pip install -r requirements-core.txt
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000

# Nạp sản phẩm + chính sách (idempotent)
SERVICE_TOKEN=local-dev-service-token AI_URL=http://127.0.0.1:8000 \
  .venv/bin/python scripts/ingest_json.py products data/knownledge/products.json
SERVICE_TOKEN=local-dev-service-token AI_URL=http://127.0.0.1:8000 \
  .venv/bin/python scripts/ingest_json.py knowledge data/knownledge/knowledge.json

# Nạp ảnh CLIP (idempotent, có resume)
.venv/bin/python scripts/ingest_images.py

# Test offline
.venv/bin/python -m pytest -q tests/test_new_core.py

# Golden eval
.venv/bin/python eval/run_eval.py
```

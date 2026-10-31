# Muadee Supermarket E-commerce

Ứng dụng thương mại điện tử B2C cho chuỗi siêu thị. Đây là README theo trạng thái code hiện tại, không phải danh sách đầy đủ các mục tiêu trong đề án.

## Kiến trúc đang chạy

```text
React + TypeScript -> REST API (NestJS) -> MongoDB
                                      \\-> FastAPI AI service (các endpoint hiện trả dữ liệu mẫu)
```

| Thành phần | Công nghệ | Trạng thái hiện tại |
|---|---|---|
| `frontend/` | React, TypeScript, Vite | Luồng khách hàng có trang sản phẩm, giỏ hàng, checkout, thanh toán, đơn hàng và tài khoản. Có chế độ mock `VITE_USE_MOCK=true`. Route `/staff` và `/admin` hiện chỉ hiển thị trang TODO. |
| `backend/` | NestJS, Mongoose | API đang đăng ký: health, auth, hồ sơ hiện tại, categories, products, stores, cart, vouchers, inventory, orders và payments. Chi tiết ở [API hiện hành](docs/api/API.md). |
| `ai-service/` | FastAPI, PyMongo, Ollama, CLIP, EasyOCR | `/chat` (gợi ý sản phẩm, LLM Ollama hoặc OpenAI, có fallback từ khóa), `/recommend` (sản phẩm tương tự/bán chạy bằng TF-IDF), `/image/analyze` (CLIP tìm sản phẩm giống ảnh, OCR, mô tả ảnh bằng moondream, tối đa 4 ảnh). `/forecast/run` vẫn là placeholder. |
| `database/` | MongoDB scripts/seed | Seed dữ liệu mẫu, tạo indexes; schema ứng dụng nằm trong `backend/src/modules/*/schemas`. |
| `docs/` | Markdown + Mermaid | API và UML phải phản ánh endpoint/luồng đã triển khai. Sơ đồ hiện hành ở `docs/uml/`. |

## Phạm vi thực tế và giới hạn

- Backend có nghiệp vụ thực cho đăng ký/đăng nhập, danh mục/sản phẩm/cửa hàng, giỏ, voucher, tồn kho, đặt hàng và một phần xử lý thanh toán.
- Đơn hàng có preview, idempotency key bắt buộc, giữ tồn và xử lý đơn hàng theo cân. Transaction MongoDB cần replica set; Atlas đáp ứng yêu cầu này.
- Thanh toán có QR VietQR, hosted-checkout URL cấu hình được, webhook HMAC và mock confirm. Chưa có adapter/đối soát thật với ngân hàng hoặc cổng thẻ.
- Dashboard admin có endpoint tổng hợp chỉ đọc `/api/v1/admin/dashboard`; dashboard đếm 26 collection đã khai báo, không tạo collection mới. Chưa có API backend đang đăng ký cho delivery, review, membership, báo cáo nghiệp vụ tổng quát, chat/knowledge, recommendation, forecast hoặc admin CRUD người dùng/nhân viên. Các thư mục/schema có mặt không đồng nghĩa endpoint đang chạy.
- Frontend mock có thể làm giao diện hoạt động mà không ghi dữ liệu thật. Kiểm tra `VITE_USE_MOCK` trước khi đánh giá luồng frontend là đã tích hợp backend.
- `docs/api/API.md` là danh sách route đang chạy cộng với các giới hạn; Swagger tại `/api/docs` là tài liệu runtime sinh từ NestJS.

## Cấu hình môi trường

Tạo `.env` ở thư mục gốc từ `.env.example`, sau đó điền cấu hình phù hợp. Backend đọc `MONGODB_URI`; AI service đọc `MONGO_URI`. Khi dùng Atlas, dùng connection string thật và cùng database cho hai biến nếu cả hai service cần truy cập. Khi chạy app ngoài Docker, hostname `mongo` không dùng được; hostname đó chỉ dành cho mạng Compose.

Backend yêu cầu tối thiểu `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` và `FRONTEND_URL`. Xem toàn bộ tên biến ở `.env.example`; không commit `.env`.

## Chạy trên Windows không dùng Docker

Dùng MongoDB Atlas replica set hoặc cài MongoDB Community Server native với replica set một node. Nếu chọn MongoDB local, mở terminal tại thư mục gốc:

```powershell
New-Item -ItemType Directory -Force mongo-data
mongod --dbpath .\mongo-data --replSet rs0 --bind_ip 127.0.0.1 --port 27017
```

Chỉ chạy một lần trong terminal khác để khởi tạo replica set:

```powershell
mongosh "mongodb://127.0.0.1:27017/admin" --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
```

Đặt cả `MONGODB_URI` và `MONGO_URI` thành `mongodb://127.0.0.1:27017/supermarket?replicaSet=rs0` nếu backend và AI service cùng dùng DB local.

Mở terminal riêng cho từng tiến trình:

```powershell
Set-Location backend
npm install
npm run start:dev
```

```powershell
Set-Location frontend
npm install
npm run dev
```

```powershell
Set-Location ai-service
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend Swagger: `http://localhost:3000/api/docs`; frontend Vite: `http://localhost:5173`; AI docs: `http://localhost:8000/docs`.

### Tính năng AI (tùy chọn)

Không cần Ollama thì web vẫn chạy; chatbot chỉ tìm theo từ khóa, không mô tả được ảnh. Để dùng đủ AI trên máy của bạn:

```powershell
ollama pull qwen2.5:3b
ollama pull moondream
```

Trong `.env`: `LLM_PROVIDER=ollama`, `LLM_MODEL=qwen2.5:3b`, `AI_SERVICE_TIMEOUT_MS=60000` (model chạy CPU, mỗi câu 15–50 giây). Lần gọi ảnh đầu tiên chậm vì phải nạp model và dựng chỉ mục CLIP. Người chỉ muốn xem giao diện có thể chạy frontend và trỏ tới backend/ai-service của người khác.

### Ảnh sản phẩm (Cloudinary)

Đặt `CLOUDINARY_URL` trong `.env` để ảnh upload ở trang admin được lưu trên Cloudinary và mọi máy đều thấy. Nếu để trống, ảnh lưu cục bộ ở `backend/uploads/` (không đưa lên Git) nên máy khác sẽ không thấy. Chuyển ảnh cũ lên cloud: `node --env-file=../.env scripts/migrate-images-to-cloudinary.js` trong thư mục `backend`.

## Seed dữ liệu

Từ thư mục `backend/`, chạy:

```powershell
npm run create-indexes
npm run seed
```

`npm run seed -- --reset` xóa và tạo lại các collection do seed quản lý. Chỉ dùng trên database development có thể xóa; không chạy trên dữ liệu cần giữ. `npm run seed:auth` tạo/cập nhật tài khoản mẫu phát triển.

## Kiểm thử

Các backend unit/E2E tests dùng MongoDB Memory Server riêng, không dùng Docker, Atlas hoặc database trong `.env`. Lần đầu có thể tải MongoDB binary vào cache.

```powershell
Set-Location backend
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
```

Frontend hiện có build/type-check, chưa khai báo test runner:

```powershell
Set-Location frontend
npm run build
```

AI service:

```powershell
Set-Location ai-service
.venv\Scripts\Activate.ps1
pytest
```

## Cấu trúc chính

```text
backend/src/modules/     NestJS feature modules and Mongoose schemas
backend/test/            HTTP E2E tests
backend/database/         index and seed scripts
frontend/src/api/         API clients and mock implementations
frontend/src/routes/      registered UI routes
ai-service/app/routers/   FastAPI endpoints
ai-service/app/services/ placeholder AI logic
ai-service/tests/        FastAPI tests
database/                 shared seed/migration area
 docs/api/                live API reference
 docs/uml/                current-state Mermaid diagrams
```

## Tài liệu

- [API và trạng thái triển khai](docs/api/API.md)
- [Use cases hiện tại](docs/uml/usecase/current-use-cases.md)
- [Sequence đặt hàng và thanh toán](docs/uml/sequence/checkout-and-payment.md)
- [Activity vòng đời đơn hàng](docs/uml/activity/order-lifecycle.md)
- [Class diagram dữ liệu cốt lõi](docs/uml/class/core-domain.md)

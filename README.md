# Ứng dụng thương mại điện tử chuỗi siêu thị B2C tích hợp AI

Đồ án chuyên ngành – Nhóm 06 – Học viện Hàng không Việt Nam
GVHD: ThS. Lê Mạnh Hùng

## 1. Kiến trúc

```
React + TS (frontend) --REST/HTTPS--> NestJS (backend) --REST--> FastAPI (ai-service)
                                          |                           |
                                          +-------- MongoDB ----------+
```

| Thư mục | Công nghệ | Vai trò |
|---|---|---|
| `frontend/` | React + TypeScript | Giao diện khách hàng, nhân viên, quản trị viên |
| `backend/` | Node.js + NestJS | Nghiệp vụ, JWT, RBAC, thanh toán, vận chuyển, cầu nối AI |
| `ai-service/` | Python + FastAPI | Chatbot (LLM + RAG), gợi ý sản phẩm, dự báo tồn kho |
| `database/` | MongoDB | Seed dữ liệu mẫu, script, migration |
| `infra/` | Docker, Nginx | Cấu hình triển khai |
| `docs/` | - | Báo cáo, UML, API, biên bản họp |

## 2. Cấu trúc thư mục

```
supermarket-ecommerce/
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── docs/
│   ├── bao-cao/            # file Word báo cáo, bản nháp từng chương
│   ├── uml/                # usecase, activity, sequence, class
│   ├── database/           # ERD, mô tả collection
│   ├── api/                # tài liệu API (export Swagger)
│   └── meeting-notes/
├── database/
│   ├── seed/               # dữ liệu mẫu (JSON): sản phẩm, cửa hàng, đơn hàng...
│   ├── migrations/
│   └── scripts/            # script import/reset DB
├── backend/                # NestJS
│   ├── test/
│   └── src/
│       ├── config/         # đọc .env, cấu hình DB, JWT, AI URL
│       ├── database/       # kết nối MongoDB
│       ├── common/         # guards (JWT, Roles), decorators, filters, pipes, dto, constants
│       └── modules/
│           ├── auth/ users/ customers/ employees/
│           ├── stores/ categories/ products/ inventory/
│           ├── carts/ orders/ vouchers/ memberships/ reviews/
│           ├── payments/ (providers/)   # QR chuyển khoản, thẻ
│           ├── deliveries/ (providers/) # chỉ gọi API đơn vị vận chuyển để khách theo dõi đơn (không có vai trò shipper)
│           ├── reports/            # doanh thu, thống kê
│           ├── ai-client/          # gọi sang ai-service
│           ├── chat/ knowledge/ ai-config/
│           ├── user-activity/ ai-feedback/
│           └── recommendations/ forecasts/
│               (mỗi module có: dto/, schemas/, *.controller.ts, *.service.ts, *.module.ts)
├── ai-service/             # FastAPI
│   ├── notebooks/          # thử nghiệm mô hình
│   ├── tests/
│   └── app/
│       ├── main.py
│       ├── core/           # config, logging, bảo mật nội bộ
│       ├── db/             # kết nối MongoDB
│       ├── routers/        # chatbot.py, recommendation.py, forecast.py
│       ├── schemas/        # Pydantic request/response
│       ├── services/
│       │   ├── chatbot/        # RAG, prompt, gọi LLM
│       │   ├── recommendation/ # lọc cộng tác + nội dung + cold-start
│       │   └── forecast/       # dự báo nhu cầu, cảnh báo tồn kho
│       ├── ml/ (models/, training/)
│       └── data/ (knowledge_samples/, eval/)
├── frontend/               # React + TS
│   ├── public/
│   └── src/
│       ├── api/            # axios client + hàm gọi API theo module
│       ├── components/     # common, product, cart, order, chat, recommendation
│       ├── pages/
│       │   ├── auth/       # đăng nhập, đăng ký
│       │   ├── customer/   # home, products, product-detail, cart, checkout, orders, profile, chat
│       │   ├── staff/      # orders, products, chat-support, reviews
│       │   └── admin/      # dashboard, products, categories, inventory, users, stores,
│       │                   # vouchers, reports, ai-forecast, ai-knowledge, ai-config
│       ├── layouts/        # CustomerLayout, StaffLayout, AdminLayout
│       ├── routes/         # định tuyến + route theo vai trò
│       ├── store/ hooks/ types/ utils/ styles/ assets/
├── infra/nginx/
└── .github/workflows/
```

## 3. Quy ước làm việc (để ít đụng code của nhau)

1. **Mỗi chức năng = 1 module backend + 1 thư mục page frontend.** Người nào nhận module thì sở hữu cả hai phía.
2. **Hợp đồng API đi trước:** thống nhất endpoint, request, response (Swagger) trước khi code. FE dùng dữ liệu giả cho tới khi BE xong.
3. **Tên collection, trường dữ liệu bám đúng mục 3.2.3 báo cáo** (User, Customer, Employee, Store, Product, Inventory, Order...).
4. **Git:** nhánh `main` (ổn định) ← `develop` ← `feature/<module>-<tên>`. Không push trực tiếp vào `main`/`develop`, tạo Pull Request và có ít nhất 1 người review.
5. **Commit:** `feat(orders): tao don hang`, `fix(auth): sua loi het han token`.
6. Không commit `.env`, chỉ commit `.env.example`.
7. AI không gửi mật khẩu/thông tin thanh toán sang LLM; khi ai-service lỗi, backend phải trả dữ liệu dự phòng (sản phẩm bán chạy / chuyển nhân viên).
8. Mỗi module backend mới tạo bằng `nest g resource modules/<ten>` để cấu trúc đồng nhất.

## 4. Gợi ý phân công (5 thành viên – điều chỉnh theo năng lực)

| TV | Phụ trách chính | Backend | Frontend |
|---|---|---|---|
| **1. Hoàng Ngọc Duy (Nhóm trưởng)** | Hạ tầng, tích hợp, bảo mật | `common/`, `config/`, `auth`, `users`, `customers`, `employees`, Docker/CI, quản lý repo | Đăng nhập/đăng ký, layouts, routes theo vai trò, `api/` |
| **2. Lê Thành Danh** | Sản phẩm và kho | `stores`, `categories`, `products`, `inventory` | `customer/home`, `products`, `product-detail`, `admin/products`, `categories`, `inventory`, `stores` |
| **3. Nguyễn Đức Tài** | Giỏ hàng, đơn hàng, thanh toán | `carts`, `orders`, `payments` (QR, thẻ) | `cart`, `checkout`, `orders` (gồm màn hình theo dõi hành trình đơn, dùng API của Ngọc), `staff/orders` |
| **4. Phạm Nguyễn Bảo Ngọc** | Theo dõi vận chuyển, ưu đãi, đánh giá, báo cáo | `deliveries` (tích hợp API đơn vị vận chuyển, bàn giao đơn, trả trạng thái/hành trình cho khách), `vouchers`, `memberships`, `reviews`, `reports` | `profile`, `admin/vouchers`, `reports`, `dashboard`, `staff/reviews` |
| **5. Nguyễn Ngọc Gia Bảo** | Toàn bộ AI | `ai-service/` + `ai-client`, `chat`, `knowledge`, `ai-config`, `user-activity`, `ai-feedback`, `recommendations`, `forecasts` | `components/chat`, `recommendation`, `customer/chat`, `staff/chat-support`, `admin/ai-*` |

Lưu ý về vận chuyển: hệ thống chỉ có 3 vai trò đăng nhập là khách hàng, nhân viên cửa hàng và quản trị viên (đúng với báo cáo). Đơn vị vận chuyển là tác nhân phụ gọi qua API; nhân viên cửa hàng bàn giao đơn, khách hàng xem hành trình, không có tài khoản/màn hình riêng cho nhân viên giao hàng.

Tài liệu API chi tiết từng module: `docs/api/API.md`.

### MongoDB indexes và tìm kiếm tri thức

Schema khai báo các index thông thường; tạo/cập nhật chúng thủ công bằng `cd backend` rồi chạy `npm run create-indexes` với `MONGODB_URI` đã được cấu hình. Production tắt `autoIndex`, vì vậy chạy lệnh này sau khi triển khai schema.

`KnowledgeDocument.embedding` dùng Atlas Vector Search khi triển khai MongoDB Atlas: tạo Search Index tên `knowledge_embedding_vector` trên collection `knowledgedocuments`, field `embedding`, kiểu `vector`, cấu hình `numDimensions` khớp model embedding và `similarity: cosine`. Local MongoDB không tạo vector index; `ai-service` cần tính cosine similarity ở tầng ứng dụng.

Khởi tạo dữ liệu phát triển (tạo `.env` từ `.env.example` trước, không điền thông tin MongoDB thật vào file được commit):

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d mongo
Set-Location backend
npm run create-indexes
npm run seed -- --reset
```

Seed có thể chạy lặp lại; `--reset` chỉ xóa và tạo lại các collection do seed quản lý. Tài khoản mẫu dùng mật khẩu phát triển `Muadee123`; mật khẩu được lưu dưới dạng bcrypt hash.

Phần AI nặng nhất, nên chia nhỏ:
- Chatbot (LLM + RAG): TV5.
- Gợi ý và dự báo: TV5 làm lõi, TV4 hỗ trợ dự báo/báo cáo khi xong phần của mình.
- Viết báo cáo: mỗi người tự viết phần chức năng của mình ở mục 3.1.4 – 3.3 (xem `docs/bao-cao/`).

## 5. Lộ trình gợi ý

1. **Tuần 1:** chốt API, dựng khung, kết nối DB, đăng nhập/RBAC, seed dữ liệu.
2. **Tuần 2–3:** sản phẩm, kho, giỏ hàng, đặt hàng, thanh toán.
3. **Tuần 4:** xử lý đơn (nhân viên), giao hàng, voucher, điểm thành viên, đánh giá.
4. **Tuần 5–6:** chatbot, gợi ý, dự báo; tích hợp vào giao diện.
5. **Tuần 7:** kiểm thử, hoàn thiện báo cáo, demo.

## 6. Chạy dự án

### Cách 1: Docker (đơn giản nhất, cả nhóm giống nhau)

```bash
cp .env.example .env
docker compose up -d --build
# Giao diện:        http://localhost:5173
# Backend Swagger:  http://localhost:3000/api/docs
# AI service docs:  http://localhost:8000/docs
```

### Cách 2: Chạy từng phần để code (cần Node 22+, Python 3.11+, MongoDB)

```bash
# Mongo chạy sẵn bằng Docker:  docker compose up -d mongo
# Khi chạy ngoài Docker, trong .env đổi MONGO_URI thành mongodb://localhost:27017/supermarket
# và AI_SERVICE_URL thành http://localhost:8000

cd backend    && npm install && npm run start:dev      # http://localhost:3000/api/docs
cd frontend   && npm install && npm run dev            # http://localhost:5173 (tự chuyển /api sang backend)
cd ai-service && python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
              pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
```

Kiểm tra: `npm test` (backend), `npm run build` (frontend), `pytest` (ai-service).

## 7. Những gì đã có sẵn trong khung code

| Phần | Đã có | Việc tiếp theo |
|---|---|---|
| backend | Kết nối MongoDB, JWT + `@Roles()` + `@Public()`, đăng ký/đăng nhập, `GET /users/me`, định dạng response/lỗi đúng `API.md`, Swagger, **module mẫu `categories`** | Mỗi người copy cấu trúc `categories` để làm module của mình |
| frontend | Router, layout 3 vai trò, chặn route theo vai trò, axios gắn JWT, đăng nhập/đăng ký, trang chủ mẫu gọi `GET /categories` | Thêm trang mới theo mẫu `HomePage` và `api/*.api.ts` |
| ai-service | FastAPI, `/health`, `/chat`, `/recommend`, `/forecast/run` (trả dữ liệu mẫu), kiểm tra `X-Internal-Key` | Bảo thay phần `TODO` trong `services/` bằng AI thật |

Lưu ý: tài khoản `STAFF`/`ADMIN` hiện chưa có API tạo; tạm thời tạo bằng script seed trong `database/seed/` (đặt `role` và mật khẩu đã băm bcrypt) hoặc sửa `role` trực tiếp trong MongoDB.

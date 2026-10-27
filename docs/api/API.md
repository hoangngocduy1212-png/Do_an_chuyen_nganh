# Tài liệu API (bản thiết kế ban đầu)

Đây là bản thống nhất giữa frontend và backend trước khi code. Khi code xong, Swagger (`/api/docs`) là nguồn chính thức; nếu khác thì cập nhật lại file này.

## 0. Quy ước chung

- Base URL backend: `/api/v1`. Dữ liệu trao đổi dạng JSON.
- Xác thực: header `Authorization: Bearer <accessToken>` (JWT). Quyền theo vai trò (RBAC):
  - `GUEST`: không cần đăng nhập
  - `CUSTOMER`, `STAFF` (nhân viên cửa hàng), `ADMIN`: theo trường `User.role`
  - `SYSTEM`: cổng thanh toán / đơn vị vận chuyển gọi vào (webhook, kiểm tra chữ ký)
- Phân trang: `?page=1&limit=20`, sắp xếp `?sort=-createdAt`.
- Thành công:
  ```json
  { "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 100 } }
  ```
- Lỗi:
  ```json
  { "success": false, "error": { "code": "OUT_OF_STOCK", "message": "Sản phẩm không đủ hàng" } }
  ```
- Mã HTTP: 200, 201, 400 (dữ liệu sai), 401 (chưa đăng nhập/token hết hạn), 403 (không đủ quyền), 404, 409 (xung đột, vd trùng email), 500.
- Nhân viên (`STAFF`) chỉ thao tác dữ liệu thuộc cửa hàng của mình (`Employee.storeId`).
- Tên trường lấy đúng theo mục 3.2.3 của báo cáo.

### Giá trị liệt kê (enum)

| Trường | Giá trị |
|---|---|
| `User.role` | `CUSTOMER`, `STAFF`, `ADMIN` |
| `User.status` | `ACTIVE`, `LOCKED` |
| `Order.receiveMethod` | `DELIVERY` (giao tận nơi), `PICKUP` (Click & Collect) |
| `Order.orderStatus` | `PENDING` → `PREPARING` → `SHIPPING` → `DELIVERED`; ngoài ra `CANCELLED`, `RETURNING`, `RETURNED`. Đơn `PICKUP` đi `PENDING` → `PREPARING` → `READY_FOR_PICKUP` → `DELIVERED` |
| `Payment.paymentMethod` | `CASH`, `CARD`, `TRANSFER` (QR chuyển khoản) |
| `Payment.paymentStatus` | `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED` |
| `Delivery.deliveryStatus` | `WAITING_PICKUP`, `IN_TRANSIT`, `DELIVERED`, `FAILED` |
| `ChatSession.status` | `AI_CHATTING`, `HANDED_OVER`, `CLOSED` |
| `DemandForecast.alertType` | `SHORTAGE`, `OVERSTOCK`, `NORMAL` |
| `DemandForecast.decisionStatus` | `PENDING`, `ACCEPTED`, `ADJUSTED` |

> Nhớ ghi chú trong báo cáo: bản tiếng Việt của các trạng thái ở mục 3.2.3 ứng với các mã này.

---

## 1. Auth, người dùng (module `auth`, `users`, `customers`, `employees`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| POST | `/auth/register` | GUEST | Đăng ký khách hàng: tạo User (role CUSTOMER) + Customer + Cart + Membership | User, Customer, Cart, Membership |
| POST | `/auth/login` | GUEST | Đăng nhập, trả `accessToken`, `refreshToken`, thông tin user | User |
| POST | `/auth/refresh` | GUEST | Cấp lại access token | User |
| POST | `/auth/forgot-password` | GUEST | Yêu cầu đặt lại mật khẩu: nhận `{ email }`, nếu email tồn tại thì tạo token đặt lại (hết hạn sau 15 phút, dùng một lần) và gửi email chứa liên kết `/reset-password?token=...`. Luôn trả 200 với cùng một thông báo dù email có tồn tại hay không (tránh dò email) | User |
| POST | `/auth/reset-password` | GUEST | Đặt mật khẩu mới: nhận `{ token, newPassword }`, kiểm tra token còn hạn, băm mật khẩu mới, vô hiệu hóa token và thu hồi mọi refresh token đang có | User |
| POST | `/auth/logout` | Đã đăng nhập | Đăng xuất (thu hồi refresh token) | - |
| GET | `/users/me` | Đã đăng nhập | Xem hồ sơ cá nhân | User, Customer/Employee |
| PATCH | `/users/me` | Đã đăng nhập | Sửa tên, SĐT, ảnh đại diện, địa chỉ mặc định | User, Customer |
| PATCH | `/users/me/password` | Đã đăng nhập | Đổi mật khẩu | User |
| DELETE | `/users/me` | CUSTOMER | Xóa/vô hiệu hóa tài khoản | User |
| GET | `/users` | ADMIN | Danh sách người dùng (lọc theo role, status) | User |
| PATCH | `/users/:id/status` | ADMIN | Khóa/mở khóa tài khoản | User |
| PATCH | `/users/:id/role` | ADMIN | Phân quyền | User |
| POST | `/employees` | ADMIN | Tạo tài khoản nhân viên, gán cửa hàng | User, Employee |
| GET | `/employees` | ADMIN | Danh sách nhân viên (lọc `storeId`) | Employee |
| PATCH | `/employees/:id` | ADMIN | Sửa vai trò công việc, cửa hàng làm việc | Employee |

Ví dụ đăng nhập:

```json
// POST /auth/login  – request
{ "email": "a@gmail.com", "password": "123456" }
// response
{ "success": true, "data": {
  "accessToken": "...", "refreshToken": "...",
  "user": { "userId": "u1", "fullName": "Nguyen A", "role": "CUSTOMER" } } }
```

Ví dụ quên và đặt lại mật khẩu:

```json
// POST /auth/forgot-password — request
{ "email": "a@gmail.com" }
// response 200
{ "success": true, "data": { "message": "Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi" } }

// POST /auth/reset-password — request
{ "token": "...", "newPassword": "NewPass123" }
// response 200
{ "success": true, "data": { "message": "Đặt lại mật khẩu thành công" } }
// lỗi 400
{ "success": false, "error": { "code": "INVALID_OR_EXPIRED_TOKEN", "message": "Liên kết đã hết hạn hoặc không hợp lệ" } }
```

### Mã lỗi của Auth

- `INVALID_CREDENTIALS` (401): Email hoặc mật khẩu không đúng.
- `ACCOUNT_LOCKED` (403): Tài khoản đã bị khóa.
- `INVALID_OR_EXPIRED_TOKEN` (400): Liên kết đặt lại không hợp lệ hoặc đã hết hạn.
- `VALIDATION_ERROR` (400): Dữ liệu gửi lên không hợp lệ.
- `TOO_MANY_REQUESTS` (429): Giới hạn số lần gọi forgot-password, ví dụ 5 lần/giờ cho mỗi email và mỗi IP.

### Quên và đặt lại mật khẩu

#### Gửi hướng dẫn đặt lại mật khẩu

`POST /auth/forgot-password` — quyền `GUEST`. Gửi hướng dẫn đặt lại mật khẩu tới email đã đăng ký. Để tránh dò tìm tài khoản, phản hồi thành công giống nhau dù email có tồn tại hay không.

Request:

```json
{ "email": "a@gmail.com" }
```

Response `200`:

```json
{ "success": true, "data": {
  "message": "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư của bạn." } }
```

Liên kết đặt lại nên chứa token dùng một lần, có thời hạn ngắn và không chứa thông tin nhạy cảm khác. Nếu email sai định dạng, trả `400` với mã lỗi `VALIDATION_ERROR`.

#### Đặt mật khẩu mới

`POST /auth/reset-password` — quyền `GUEST`. Xác thực token đặt lại và cập nhật mật khẩu. Token đã dùng, không hợp lệ hoặc hết hạn không được chấp nhận.

Request:

```json
{ "token": "reset-token-from-email", "newPassword": "matkhau-moi-an-toan" }
```

Response `200`:

```json
{ "success": true, "data": { "message": "Mật khẩu của bạn đã được cập nhật." } }
```

Lỗi `400` trả mã `INVALID_OR_EXPIRED_TOKEN` nếu token không hợp lệ, đã dùng hoặc hết hạn; trả mã `VALIDATION_ERROR` nếu mật khẩu mới không đạt chính sách tối thiểu 8 ký tự.

> Cần bổ sung hai trường vào collection User ở mục 3.2.3 của báo cáo: `passwordResetToken` (String, lưu bản băm của token, không lưu token gốc) và `passwordResetExpires` (Date).

## 2. Cửa hàng, danh mục, sản phẩm, tồn kho (`stores`, `categories`, `products`, `inventory`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| GET | `/stores` | GUEST | Danh sách cửa hàng (xem thông tin cửa hàng) | Store |
| GET | `/stores/:id` | GUEST | Chi tiết cửa hàng | Store |
| POST / PATCH | `/stores`, `/stores/:id` | ADMIN | Thêm/sửa cửa hàng, bật/tắt hoạt động | Store |
| GET | `/categories` | GUEST | Danh sách danh mục | Category |
| POST / PATCH / DELETE | `/categories`, `/categories/:id` | ADMIN, STAFF | Quản lý danh mục | Category |
| GET | `/products` | GUEST | Danh sách + tìm kiếm + lọc. Query: `q`, `categoryId`, `minPrice`, `maxPrice`, `storeId`, `collection`, `inStock`, `sort`, `page`, `limit`. `collection=bestseller` sắp theo tổng số lượng bán 30 ngày gần nhất tại `storeId`, chỉ tính đơn có `orderStatus=DELIVERED`; `collection=deals` chỉ lấy sản phẩm có `salePrice` và đang trong khoảng `saleStartDate`–`saleEndDate`. `inStock=true` chỉ lấy sản phẩm còn hàng tại `storeId`. `sort`: `price`, `-price`, `-createdAt`, `-sold`, `-discount` (ngoài các cách sắp xếp phù hợp nhất hiện có). Khi có `storeId` trả kèm `stock`; mỗi sản phẩm trả thêm `avgRating`, `reviewCount`, `soldCount` (với `collection=bestseller`), `salePrice`, `saleEndDate` (nếu có) | Product, Inventory |
| GET | `/products/:id` | GUEST | Chi tiết sản phẩm (mô tả, giá, đơn vị, đánh giá trung bình) | Product, Review |
| POST | `/products` | ADMIN, STAFF | Thêm sản phẩm (kèm upload ảnh) | Product |
| PATCH | `/products/:id` | ADMIN, STAFF | Sửa sản phẩm, đổi trạng thái đang bán/ngừng bán | Product |
| GET | `/inventory` | ADMIN, STAFF | Tồn kho. Query: `storeId`, `productId`, `lowStock=true` (STAFF tự lọc theo cửa hàng của mình) | Inventory |
| POST | `/inventory/import` | ADMIN | Nhập kho: `{ storeId, productId, quantity }` | Inventory |
| POST | `/inventory/export` | ADMIN | Xuất kho. Lỗi `OUT_OF_STOCK` nếu vượt tồn | Inventory |

Ghi chú: Cần bổ sung vào collection Product ở mục 3.2.3 của báo cáo ba trường tùy chọn: `salePrice` (Number), `saleStartDate` (Date), `saleEndDate` (Date).

## 3. Giỏ hàng (`carts`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| GET | `/cart` | CUSTOMER | Xem giỏ hàng: danh sách dòng, tổng số sản phẩm, tổng tiền | Cart, CartItem, Product |
| POST | `/cart/items` | CUSTOMER | Thêm sản phẩm `{ productId, quantity }` (cộng dồn nếu đã có) | CartItem |
| PATCH | `/cart/items/:itemId` | CUSTOMER | Đổi số lượng | CartItem |
| DELETE | `/cart/items/:itemId` | CUSTOMER | Xóa dòng | CartItem |
| DELETE | `/cart` | CUSTOMER | Xóa toàn bộ giỏ | CartItem |

## 4. Đơn hàng (`orders`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| POST | `/orders` | CUSTOMER | Đặt hàng từ giỏ hoặc mua ngay. Kiểm tra tồn kho tại `storeId`, áp voucher, tạo Order + OrderItem, trừ/giữ tồn | Order, OrderItem, Inventory, Voucher |
| GET | `/orders/my` | CUSTOMER | Lịch sử đơn của tôi (lọc `orderStatus`) | Order |
| GET | `/orders/:id` | CUSTOMER (đơn của mình), STAFF (cửa hàng mình), ADMIN | Chi tiết đơn + sản phẩm + thanh toán + vận chuyển | Order, OrderItem, Payment, Delivery |
| PATCH | `/orders/:id/shipping-info` | CUSTOMER | Sửa thông tin nhận hàng khi đơn còn `PENDING` | Order |
| POST | `/orders/:id/cancel` | CUSTOMER | Hủy đơn khi chưa giao (hoàn tiền nếu đã thanh toán) | Order, Payment |
| POST | `/orders/:id/return` | CUSTOMER | Yêu cầu hoàn trả khi đã giao | Order |
| GET | `/orders` | STAFF, ADMIN | Danh sách đơn cần xử lý (lọc `storeId`, `orderStatus`, `receiveMethod`, ngày) | Order |
| POST | `/orders/:id/accept` | STAFF | Tiếp nhận đơn (gán `employeeId`) | Order |
| PATCH | `/orders/:id/items/:itemId/weight` | STAFF | Nhập khối lượng thực tế (`actualWeight`) cho hàng bán theo cân, tính lại tiền | OrderItem, Order |
| PATCH | `/orders/:id/status` | STAFF, ADMIN | Chuyển trạng thái hợp lệ: `PREPARING`, `READY_FOR_PICKUP`, `DELIVERED`, ... | Order |

Ví dụ đặt hàng:

```json
// POST /orders – request
{
  "storeId": "s1",
  "receiveMethod": "DELIVERY",
  "shippingAddress": "12 Nguyen Hue, Q1",
  "voucherCode": "SALE10",
  "items": [ { "productId": "p1", "quantity": 2 } ]   // bỏ "items" nếu đặt từ giỏ hàng
}
// response 201
{ "success": true, "data": { "orderId": "o1", "orderStatus": "PENDING",
  "totalAmount": 180000, "discountAmount": 20000 } }
```

## 5. Thanh toán (`payments`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| POST | `/payments` | CUSTOMER | Tạo giao dịch cho đơn: `{ orderId, paymentMethod }`. `TRANSFER` trả mã QR; `CARD` trả `paymentUrl` của cổng thanh toán | Payment |
| GET | `/payments/:id` | CUSTOMER (đơn của mình), STAFF, ADMIN | Xem trạng thái giao dịch | Payment |
| GET | `/orders/:id/payments` | CUSTOMER, STAFF, ADMIN | Lịch sử thanh toán của đơn | Payment |
| POST | `/payments/webhook/:provider` | SYSTEM | Cổng thanh toán báo kết quả. Xác thực chữ ký, cập nhật `paymentStatus`, `transactionCode`, `paidAt` | Payment, Order |
| POST | `/payments/:id/refund` | STAFF, ADMIN | Hoàn tiền / hủy giao dịch | Payment |

## 6. Vận chuyển – theo dõi đơn hàng (`deliveries`)

Nhóm không có vai trò nhân viên giao hàng. Nhân viên cửa hàng chỉ bàn giao đơn cho đơn vị vận chuyển (qua API), khách hàng theo dõi hành trình.

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| POST | `/orders/:id/delivery` | STAFF | Bàn giao đơn `DELIVERY` cho đơn vị vận chuyển: gọi API tạo vận đơn, lưu `carrierName`, `trackingCode`, `shippingFee`; chuyển đơn sang `SHIPPING` | Delivery, Order |
| GET | `/orders/:id/tracking` | CUSTOMER (đơn của mình), STAFF, ADMIN | Hành trình và trạng thái giao hàng hiện tại (gọi API vận chuyển, có lưu đệm) | Delivery |
| POST | `/deliveries/webhook/:carrier` | SYSTEM | Đơn vị vận chuyển cập nhật trạng thái; `DELIVERED` thì đóng đơn, ghi `deliveredAt` | Delivery, Order |
| GET | `/deliveries/:id` | STAFF, ADMIN | Chi tiết vận đơn | Delivery |

Phản hồi theo dõi:

```json
// GET /orders/o1/tracking
{ "success": true, "data": {
  "carrierName": "GHN", "trackingCode": "GHN123", "deliveryStatus": "IN_TRANSIT",
  "events": [
    { "time": "2026-11-02T09:00:00Z", "status": "Đã lấy hàng", "location": "Kho Q1" },
    { "time": "2026-11-02T13:30:00Z", "status": "Đang giao", "location": "Q3" } ] } }
```

## 7. Voucher, thành viên, đánh giá (`vouchers`, `memberships`, `reviews`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| GET | `/vouchers` | ADMIN | Danh sách voucher | Voucher |
| GET | `/vouchers/available` | CUSTOMER | Danh sách voucher đang còn hiệu lực (`startDate` ≤ hôm nay ≤ `endDate`), dùng cho trang "Voucher của tôi" | Voucher |
| POST / PATCH | `/vouchers`, `/vouchers/:id` | ADMIN | Tạo/sửa voucher | Voucher |
| POST | `/vouchers/validate` | CUSTOMER | Kiểm tra mã `{ code, orderAmount }`, trả số tiền giảm | Voucher |
| GET | `/memberships/me` | CUSTOMER | Xem điểm và hạng thành viên | Membership |
| GET | `/products/:id/reviews` | GUEST | Xem đánh giá của sản phẩm | Review |
| POST | `/reviews` | CUSTOMER | Đánh giá sản phẩm của đơn đã giao `{ orderId, productId, rating, comment }` | Review |
| GET | `/reviews` | STAFF, ADMIN | Quản lý đánh giá, phản ánh | Review |
| DELETE | `/reviews/:id` | STAFF, ADMIN | Ẩn/xóa đánh giá vi phạm | Review |

## 8. Báo cáo, thống kê (`reports`)

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/reports/revenue` | ADMIN | Doanh thu theo `groupBy` (`day`, `month` hoặc `year`), lọc `storeId`, `from`, `to` |
| GET | `/reports/orders` | ADMIN | Thống kê số đơn theo trạng thái |
| GET | `/reports/reviews` | ADMIN | Số lượng và điểm đánh giá |
| GET | `/reports/ai-usage` | ADMIN | Số hội thoại, tỷ lệ chuyển nhân viên, tỷ lệ phản hồi hữu ích |

---

## 9. Tính năng AI (backend gọi sang `ai-service`)

Frontend chỉ gọi backend. Backend (module `ai-client`) gọi ai-service, nếu lỗi/quá thời gian thì dùng phương án dự phòng.

### 9.1 Chatbot (`chat`, `knowledge`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| POST | `/chat/sessions` | GUEST, CUSTOMER | Mở phiên hội thoại | ChatSession |
| POST | `/chat/sessions/:id/messages` | GUEST, CUSTOMER | Gửi câu hỏi `{ content, storeId? }`. Backend gắn ngữ cảnh, gọi ai-service (RAG), lưu cả hai tin nhắn. Hỏi trạng thái đơn chỉ khi đã đăng nhập | ChatMessage |
| GET | `/chat/sessions/:id/messages` | Chủ phiên, STAFF được nhận | Lịch sử tin nhắn | ChatMessage |
| POST | `/chat/sessions/:id/handover` | GUEST, CUSTOMER | Yêu cầu chuyển nhân viên CSKH (chatbot tự gọi khi không đủ thông tin) | ChatSession |
| GET | `/chat/sessions?status=HANDED_OVER` | STAFF | Hàng đợi hội thoại cần xử lý | ChatSession |
| POST | `/chat/sessions/:id/accept` | STAFF | Nhận hội thoại (gán `employeeId`) | ChatSession |
| POST | `/chat/sessions/:id/staff-messages` | STAFF | Nhân viên trả lời khách | ChatMessage |
| POST | `/chat/sessions/:id/close` | STAFF, CUSTOMER | Đóng phiên | ChatSession |
| GET / POST / PATCH / DELETE | `/knowledge`, `/knowledge/:id` | ADMIN | Quản lý FAQ, chính sách, khuyến mãi; khi lưu thì tính lại `embedding` | KnowledgeDocument |

Real-time tin nhắn cho nhân viên: dùng polling mỗi 3–5 giây hoặc WebSocket (chốt khi code).

### 9.2 Gợi ý sản phẩm (`recommendations`, `user-activity`, `ai-feedback`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| GET | `/recommendations` | GUEST, CUSTOMER | Query: `placement` (`home`, `product` hoặc `cart`), `productId?`, `storeId`. Chỉ trả sản phẩm đang bán và còn hàng. Dự phòng: sản phẩm bán chạy | Product, Inventory |
| POST | `/activities` | GUEST, CUSTOMER | Ghi hành vi `{ productId, activityType }` với `activityType` là `VIEW`, `ADD_TO_CART` hoặc `SEARCH` | UserActivity |
| POST | `/ai-feedback` | CUSTOMER | Đánh giá hữu ích: `{ feedbackType, messageId?, productId?, isHelpful }` với `feedbackType` là `CHATBOT` hoặc `RECOMMENDATION` | AIFeedback |

### 9.3 Dự báo tồn kho (`forecasts`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| GET | `/forecasts` | ADMIN | Danh sách dự báo + cảnh báo. Query: `storeId`, `alertType`, `decisionStatus` | DemandForecast |
| POST | `/forecasts/run` | ADMIN | Chạy dự báo cho cửa hàng/sản phẩm (hoặc chạy định kỳ) | DemandForecast |
| PATCH | `/forecasts/:id/decision` | ADMIN | Chấp nhận hoặc điều chỉnh `{ decisionStatus, approvedQuantity }`. Chỉ ghi quyết định, không tự nhập/xuất kho | DemandForecast |

### 9.4 Cấu hình AI (`ai-config`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| GET | `/ai-config` | ADMIN | Xem cấu hình các chức năng AI | AIConfig |
| PATCH | `/ai-config/:featureKey` | ADMIN | Bật/tắt, đổi `modelName`, `parameters` (`featureKey`: `CHATBOT`, `RECOMMENDATION`, `FORECAST`) | AIConfig |

---

## 10. API nội bộ của `ai-service` (FastAPI)

Chỉ backend gọi, không public ra ngoài. Mọi request kèm header `X-Internal-Key: <INTERNAL_API_KEY>`. Swagger tự sinh tại `:8000/docs`.

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/health` | Kiểm tra dịch vụ |
| POST | `/chat` | Trả lời câu hỏi bằng RAG |
| POST | `/recommend` | Tính danh sách gợi ý |
| POST | `/forecast/run` | Dự báo nhu cầu và cảnh báo tồn kho |

```json
// POST /chat – request (backend đã lọc dữ liệu, không có mật khẩu/thanh toán)
{ "sessionId": "c1", "message": "Nguyên liệu nấu canh chua?", "storeId": "s1",
  "history": [ { "role": "user", "content": "..." } ],
  "customerContext": { "orders": [ { "orderId": "o1", "orderStatus": "SHIPPING" } ] } }
// response
{ "answer": "...", "sources": ["knowledgeId1"], "needHandover": false }

// POST /recommend – request
{ "customerId": "cu1", "placement": "product", "productId": "p1", "storeId": "s1", "limit": 8 }
// response
{ "items": [ { "productId": "p2", "score": 0.82, "reason": "Thường mua cùng" } ], "strategy": "hybrid" }

// POST /forecast/run – request
{ "storeId": "s1", "productIds": ["p1"], "periodDays": 7 }
// response
{ "results": [ { "productId": "p1", "predictedQuantity": 120, "currentStock": 40,
  "alertType": "SHORTAGE", "suggestedQuantity": 90 } ] }
```

## 11. Phân quyền tóm tắt

| Nhóm chức năng | GUEST | CUSTOMER | STAFF | ADMIN |
|---|---|---|---|---|
| Xem cửa hàng, sản phẩm, tìm kiếm | ✔ | ✔ | ✔ | ✔ |
| Đăng ký, đăng nhập | ✔ | ✔ | ✔ | ✔ |
| Giỏ hàng, đặt hàng, thanh toán, theo dõi đơn | | ✔ | | |
| Xử lý đơn, bàn giao vận chuyển (cửa hàng mình) | | | ✔ | ✔ |
| Quản lý sản phẩm, danh mục | | | ✔ | ✔ |
| Nhập/xuất kho, voucher, người dùng, báo cáo | | | | ✔ |
| Chatbot | ✔ | ✔ | | |
| Nhận hội thoại chuyển từ chatbot | | | ✔ | |
| Dự báo, kiến thức chatbot, cấu hình AI | | | | ✔ |

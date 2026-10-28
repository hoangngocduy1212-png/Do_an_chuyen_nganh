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
| GET | `/users/me` | Đã đăng nhập | Xem hồ sơ cá nhân, trả thêm `createdAt`, `avatar`, `addresses`, `defaultAddress` | User, Customer/Employee |
| PATCH | `/users/me` | Đã đăng nhập | Sửa hồ sơ, nhận `{ fullName, phone, avatar }` | User, Customer |
| POST | `/users/me/avatar` | Đã đăng nhập | Tải ảnh đại diện (multipart, jpg/png/webp ≤ 2MB), trả `avatar` URL | User |
| GET | `/users/me/addresses` | CUSTOMER | Danh sách tối đa 5 địa chỉ đã lưu | Customer |
| POST | `/users/me/addresses` | CUSTOMER | Thêm địa chỉ `{ label, recipientName, phone, addressLine, isDefault }`; lỗi `ADDRESS_LIMIT_REACHED` nếu vượt quá 5 địa chỉ | Customer |
| PATCH | `/users/me/addresses/:addressId` | CUSTOMER | Sửa nhãn, người nhận, điện thoại, địa chỉ và trạng thái mặc định | Customer |
| DELETE | `/users/me/addresses/:addressId` | CUSTOMER | Xóa địa chỉ; lỗi `CANNOT_DELETE_ONLY_DEFAULT_ADDRESS` nếu chỉ còn một địa chỉ mặc định | Customer |
| PATCH | `/users/me/addresses/:addressId/default` | CUSTOMER | Đặt địa chỉ làm mặc định | Customer |
| PATCH | `/users/me/password` | Đã đăng nhập | Đổi mật khẩu `{ currentPassword, newPassword }`; lỗi `INVALID_CURRENT_PASSWORD` (400) | User |
| DELETE | `/users/me` | CUSTOMER | Vô hiệu hóa tài khoản, nhận `{ password }` và thu hồi mọi refresh token; status chuyển `LOCKED` hoặc `DELETED` | User |
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

Ghi chú cập nhật báo cáo mục 3.2.3:
- User: thêm `avatar` (String), `createdAt` (Date).
- Customer: thêm `addresses` (Array<{ addressId, label, recipientName, phone, addressLine, isDefault }>), giữ `address` là địa chỉ mặc định để tương thích.
- Đề xuất cần nhóm chốt: 1 điểm cho mỗi 10.000đ của đơn đã giao thành công; hạng xét theo `lifetimePoints` với ngưỡng Thường 0, Bạc 500, Vàng 1.000, Kim cương 3.000.

## 2. Cửa hàng, danh mục, sản phẩm, tồn kho (`stores`, `categories`, `products`, `inventory`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| GET | `/stores` | GUEST | Danh sách cửa hàng (xem thông tin cửa hàng) | Store |
| GET | `/stores/:id` | GUEST | Chi tiết cửa hàng | Store |
| POST / PATCH | `/stores`, `/stores/:id` | ADMIN | Thêm/sửa cửa hàng, bật/tắt hoạt động; phí giao mặc định lấy từ `DEFAULT_SHIPPING_FEE` | Store |
| GET | `/categories` | GUEST | Danh sách danh mục | Category |
| POST / PATCH / DELETE | `/categories`, `/categories/:id` | ADMIN, STAFF | Quản lý danh mục | Category |
| GET | `/products` | GUEST | Danh sách + tìm kiếm không dấu trên `searchText` + lọc. Query: `q`, `categoryId`, `minPrice`, `maxPrice`, `storeId`, `collection`, `inStock`, `sort`, `page`, `limit` (tối đa 50). `collection=bestseller` sắp theo tổng số lượng bán 30 ngày gần nhất tại `storeId`, chỉ tính đơn `DELIVERED`; kết quả được lưu đệm 10 phút. `collection=deals` chỉ lấy giá sale đang hiệu lực. `inStock=true` yêu cầu `storeId`. Khi có `storeId` trả kèm tồn khả dụng `stock = quantity - reservedQuantity`; `salePrice` chỉ có trong thời gian sale. | Product, Inventory, Order, OrderItem |
| GET | `/products/:id` | GUEST | Chi tiết sản phẩm, đánh giá trung bình và tồn khả dụng theo query `storeId` (nếu có) | Product, Review, Inventory |
| POST | `/products` | ADMIN, STAFF | Tạo sản phẩm, multipart field `image` (JPG/PNG/WebP, tối đa 2 MB); ảnh được lưu dưới `/uploads` | Product |
| PATCH | `/products/:id` | ADMIN, STAFF | Sửa sản phẩm/trạng thái; nhận ảnh theo cùng quy tắc upload | Product |
| GET | `/inventory` | ADMIN, STAFF | Tồn kho. Query: `storeId`, `productId`, `lowStock=true`; STAFF luôn bị giới hạn vào cửa hàng trong JWT | Inventory |
| POST | `/inventory/import` | ADMIN | Nhập kho: `{ storeId, productId, quantity }` | Inventory |
| POST | `/inventory/export` | ADMIN | Xuất kho. Lỗi `OUT_OF_STOCK` nếu vượt tồn | Inventory |

Ghi chú: Collection Product hỗ trợ `salePrice` (Number), `saleStartDate` (Date), `saleEndDate` (Date). Quy tắc phí giao hàng: `PICKUP=0`; `DELIVERY` dùng `Store.shippingFee.baseFee` (mặc định `DEFAULT_SHIPPING_FEE=20000`) và miễn phí khi subtotal trước voucher đạt `FREE_SHIP_THRESHOLD=200000`. Hai giá trị mặc định có thể ghi đè từ `.env`.

## 3. Giỏ hàng (`carts`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| GET | `/cart` | CUSTOMER | Xem giỏ hàng: danh sách dòng, tổng số sản phẩm, tổng tiền | Cart, CartItem, Product |
| POST | `/cart/items` | CUSTOMER | Thêm sản phẩm `{ productId, quantity, storeId? }` (cộng dồn; trả `CART_STORE_MISMATCH` nếu cửa hàng khác, cần xóa giỏ cũ trước) | Cart, CartItem |
| PATCH | `/cart/items/:itemId` | CUSTOMER | Đổi số lượng | CartItem |
| DELETE | `/cart/items/:itemId` | CUSTOMER | Xóa dòng | CartItem |
| DELETE | `/cart` | CUSTOMER | Xóa toàn bộ giỏ | CartItem |
| POST | `/cart/validate` | CUSTOMER | Kiểm tra giỏ với tồn kho và giá hiện tại tại `storeId`, trả danh sách thay đổi | Cart, Inventory, Product |

`GET /cart` trả `items` dạng `{ itemId, product, quantity, lineTotal, stock, priceAtAdd, currentPrice, priceChanged, available }`, kèm `totalItems` và `totalAmount`. Giỏ gắn với một `storeId`. Sản phẩm đơn vị `kg` phải theo bước 0,5 kg; các đơn vị khác phải là số nguyên từ 1. Số lượng vượt tồn khả dụng được tự giảm xuống mức tối đa hợp lệ và phản hồi có `quantityAdjusted`; nếu không còn tồn trả `OUT_OF_STOCK`. `POST /cart/validate` trả `{ storeId, valid, changes }` để phát hiện giá, tình trạng bán hoặc lượng tồn đã thay đổi.

Mã lỗi các API mục này: `CART_STORE_MISMATCH`, `OUT_OF_STOCK`, `INVALID_QUANTITY`, `INVALID_IMAGE_TYPE`, `PRODUCT_NOT_FOUND`, `STORE_NOT_FOUND`.

## 4. Đơn hàng (`orders`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| POST | `/orders` | CUSTOMER | Đặt hàng từ giỏ tại `storeId`. Kiểm tra tồn kho, áp voucher, tạo Order + OrderItem, giữ tồn | Order, OrderItem, Inventory, Voucher |
| GET | `/orders/my` | CUSTOMER | Lịch sử đơn của tôi (lọc `orderStatus`) | Order |
| GET | `/orders/:id` | CUSTOMER (đơn của mình), STAFF (cửa hàng mình), ADMIN | Chi tiết đơn + sản phẩm + thanh toán + vận chuyển | Order, OrderItem, Payment, Delivery |
| PATCH | `/orders/:id/shipping-info` | CUSTOMER | Sửa thông tin nhận hàng khi đơn còn `PENDING` | Order |
| POST | `/orders/:id/cancel` | CUSTOMER | Hủy đơn khi chưa giao (hoàn tiền nếu đã thanh toán) | Order, Payment |
| POST | `/orders/:id/return` | CUSTOMER | Yêu cầu hoàn trả khi đã giao | Order |
| GET | `/orders` | STAFF, ADMIN | Danh sách đơn cần xử lý (lọc `storeId`, `orderStatus`, `receiveMethod`, ngày) | Order |
| POST | `/orders/:id/accept` | STAFF | Tiếp nhận đơn (gán `employeeId`) | Order |
| PATCH | `/orders/:id/items/:itemId/weight` | STAFF | Nhập khối lượng thực tế (`actualWeight`) cho hàng bán theo cân, tính lại tiền | OrderItem, Order |
| PATCH | `/orders/:id/status` | STAFF, ADMIN | Chuyển trạng thái hợp lệ: `PREPARING`, `READY_FOR_PICKUP`, `DELIVERED`, ... | Order |
| POST | `/orders/preview` | CUSTOMER | Tính trước tổng tiền: `{ storeId, receiveMethod, shippingAddress?, voucherCode? }` → `{ subtotal, discountAmount, shippingFee, totalAmount, estimatedPoints, hasWeightedItems, freeShipRemaining }` | Cart, Voucher |

Ví dụ đặt hàng:

```json
// POST /orders – request
{
  "storeId": "s1",
  "receiveMethod": "DELIVERY",
  "shippingAddress": "12 Nguyen Hue, Q1",
  "voucherCode": "SALE10"
}
// response 201
{ "success": true, "data": { "orderId": "o1", "orderStatus": "PENDING",
  "totalAmount": 180000, "discountAmount": 20000 } }
```

`POST /orders` tạo đơn từ giỏ hàng hiện tại tại cửa hàng được chọn, nhận thêm `recipientName`, `recipientPhone`, `pickupTime`, `note` và hỗ trợ header `Idempotency-Key`; yêu cầu lặp lại cùng key trả về đơn hàng đã tạo. Nếu tồn kho không đủ, API trả HTTP 409, mã `OUT_OF_STOCK` kèm danh sách sản phẩm thiếu. Không cho đặt hàng tại cửa hàng có `status` khác `ACTIVE` (mã `STORE_UNAVAILABLE`). Với `DELIVERY`, địa chỉ phải nằm trong `Store.deliveryZones`; `PICKUP` không tính phí giao hàng.

`GET /orders/my` trả mỗi đơn kèm `items` rút gọn (tối đa 2 sản phẩm), `itemCount` và `paymentStatus`.

Chỉ cho phép hủy khi `orderStatus` là `PENDING`; nếu khác, trả mã `ORDER_NOT_CANCELLABLE`. Hủy sẽ giải phóng tồn kho và lượt voucher; giao dịch đã thanh toán được đánh dấu hoàn tiền. Chỉ cho phép yêu cầu trả hàng khi `orderStatus` là `DELIVERED`; nếu không, trả mã `ORDER_NOT_RETURNABLE`. Hàng theo cân phải được nhập đủ khối lượng trước khi chuyển sang `SHIPPING`/`READY_FOR_PICKUP`; đơn trực tuyến còn thiếu tiền không thể chuyển sang `DELIVERED` (`PAYMENT_NOT_SETTLED`).

Ghi chú cập nhật báo cáo mục 3.2.3: collection Order cần có thêm `shippingFee` (Number), `recipientName`, `recipientPhone` (String), `pickupTime` (Date, tùy chọn), `note` (String), `subtotal` (Number).

Các quy tắc cần nhóm chốt (đề xuất):
- Đề xuất chốt phí vận chuyển cố định hay tính theo khoảng cách, và ngưỡng giá trị đơn hàng được miễn phí vận chuyển (nếu có).
- Đề xuất cách xử lý phần chênh lệch tiền của hàng bán theo cân khi đơn đã được thanh toán trực tuyến.
- Đề xuất có cho thanh toán tiền mặt khi giao hàng (COD) hay không.
- Đề xuất giữ tồn kho 15 phút cho đơn chưa thanh toán.

## 5. Thanh toán (`payments`)

| Method | Endpoint | Quyền | Mô tả | Collection |
|---|---|---|---|---|
| POST | `/payments` | CUSTOMER | Tạo hoặc lấy lại giao dịch đang chờ cho đơn: `{ orderId, paymentMethod }`. `TRANSFER` trả QR VietQR; `CARD` trả `paymentUrl` của hosted checkout đã cấu hình; `CASH` không tạo giao dịch trực tuyến | Payment |
| GET | `/payments/:id` | CUSTOMER (đơn của mình), STAFF (cửa hàng mình), ADMIN | Xem trạng thái giao dịch | Payment |
| GET | `/orders/:id/payments` | CUSTOMER (đơn của mình), STAFF (cửa hàng mình), ADMIN | Lịch sử thanh toán của đơn | Payment |
| POST | `/payments/webhook/:provider` | SYSTEM (HMAC-SHA256) | Nhận `{ paymentId, transactionCode, amount, status }`; xác thực chữ ký, chống lặp mã giao dịch, đối chiếu số tiền, cập nhật Payment và Order | Payment, Order |
| POST | `/payments/mock/:paymentId/confirm` | ADMIN (chỉ non-production) | Giả lập kết quả giao dịch `{ status: "SUCCESS" \| "FAILED", transactionCode? }` | Payment, Order |
| POST | `/payments/:id/refund` | STAFF (cửa hàng mình), ADMIN | Hoàn một phần hoặc toàn bộ giao dịch thành công: `{ amount?, reason }` | Payment, Order |

`POST /payments` với `paymentMethod` là `TRANSFER` trả `{ paymentId, qrCodeUrl, bankName, accountNumber, accountName, amount, transferContent, expiresAt }`. Với `CARD`, API trả `{ paymentId, paymentUrl, amount, expiresAt }`. Giao dịch dùng lại bản ghi `PENDING` hiện có; hết thời hạn giữ tồn (15 phút với thanh toán trực tuyến) thì không thể thanh toán. Với `CASH`, endpoint này trả `PAYMENT_METHOD_UNSUPPORTED`; đơn CASH đã có Payment `PENDING` được đánh dấu `SUCCESS` khi nhân viên xác nhận giao/nhận hàng.

Webhook gửi chữ ký hex HMAC-SHA256 trong header `x-payment-signature`, tính trên **nguyên văn body JSON** bằng `PAYMENT_WEBHOOK_SECRET`. Bản tin thành công cập nhật `paidAmount`/`amountDue`, đặt `Order.paymentStatus=SUCCESS` và bỏ `reservationExpiresAt`; bản tin thất bại đặt Payment và Order thành `FAILED`. Gửi lại cùng `transactionCode` cho đúng giao dịch là idempotent; dùng lại mã giao dịch cho nội dung/giao dịch khác trả `PAYMENT_TRANSACTION_CONFLICT`. Mock confirm chỉ khả dụng ngoài production và chỉ ADMIN được gọi.

Ví dụ tạo QR chuyển khoản:

```powershell
curl.exe -X POST "http://localhost:3000/api/v1/payments" `
  -H "Authorization: Bearer <accessToken>" `
  -H "Content-Type: application/json" `
  -d '{"orderId":"<orderObjectId>","paymentMethod":"TRANSFER"}'
```

Ví dụ giả lập thanh toán thành công trong môi trường phát triển:

```powershell
curl.exe -X POST "http://localhost:3000/api/v1/payments/mock/<paymentObjectId>/confirm" `
  -H "Authorization: Bearer <adminAccessToken>" `
  -H "Content-Type: application/json" `
  -d '{"status":"SUCCESS"}'
```

Các lỗi thanh toán gồm `PAYMENT_NOT_FOUND`, `PAYMENT_METHOD_UNSUPPORTED`, `PAYMENT_METHOD_MISMATCH`, `PAYMENT_ALREADY_SETTLED`, `PAYMENT_EXPIRED`, `PAYMENT_CONFIGURATION_MISSING`, `PAYMENT_SIGNATURE_INVALID`, `PAYMENT_TRANSACTION_CONFLICT`, `PAYMENT_AMOUNT_MISMATCH`, `PAYMENT_NOT_REFUNDABLE`, `PAYMENT_REFUND_AMOUNT_INVALID` và `PAYMENT_NOT_SETTLED`.

Cấu hình trong `.env`:

| Biến | Mục đích |
|---|---|
| `PAYMENT_WEBHOOK_SECRET` | Khóa HMAC-SHA256 tối thiểu 32 ký tự; cần đặt để nhận webhook thật |
| `PAYMENT_BANK_ID` | Mã ngân hàng/BIN VietQR |
| `PAYMENT_BANK_NAME` | Tên ngân hàng trả trong response |
| `PAYMENT_ACCOUNT_NUMBER` | Số tài khoản nhận tiền |
| `PAYMENT_ACCOUNT_NAME` | Tên chủ tài khoản in trên QR |
| `PAYMENT_CARD_CHECKOUT_URL` | URL hosted-checkout của nhà cung cấp thẻ; backend nối `paymentId`, `orderCode`, `amount` |
| `FREE_SHIP_THRESHOLD` | Ngưỡng miễn phí vận chuyển theo subtotal trước voucher (mặc định `200000`) |
| `DEFAULT_SHIPPING_FEE` | Phí vận chuyển mặc định khi cửa hàng không có phí riêng (mặc định `20000`) |

Thông tin ngân hàng chỉ cần cấu hình khi bật thanh toán `TRANSFER`; checkout thẻ cần URL do nhà cung cấp cung cấp. Hiện không cần cài thêm package: `supertest`, Jest và MongoDB Memory Server đã nằm trong `backend/package.json`.

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
| GET | `/vouchers/available` | CUSTOMER | Danh sách voucher đang còn hiệu lực; hỗ trợ query `orderAmount` để lọc theo giá trị tối thiểu của đơn | Voucher |
| POST / PATCH | `/vouchers`, `/vouchers/:id` | ADMIN | Tạo/sửa voucher | Voucher |
| DELETE | `/vouchers/:id` | ADMIN | Xóa voucher | Voucher |
| POST | `/vouchers/validate` | CUSTOMER | Kiểm tra mã `{ code, orderAmount }`, trả số tiền giảm | Voucher |
| GET | `/memberships/me` | CUSTOMER | Trả `{ memberCode, memberLevel, pointBalance, lifetimePoints, nextLevel, pointsToNextLevel, levels: [{ name, minPoints, benefits }] }` | Membership |
| GET | `/memberships/me/transactions` | CUSTOMER | Lịch sử điểm, phân trang. Mỗi dòng: `transactionId`, `type` (`EARN`, `REDEEM`, `ADJUST`), `points` (+/−), `balanceAfter`, `orderId`?, `note`, `createdAt` | PointTransaction |
| GET | `/products/:id/reviews` | GUEST | Xem đánh giá của sản phẩm | Review |
| GET | `/reviews/my` | CUSTOMER | Query `status=pending` (sản phẩm thuộc đơn DELIVERED chưa đánh giá) hoặc `status=done` (đã đánh giá) | Review, OrderItem |
| POST | `/reviews` | CUSTOMER | Đánh giá sản phẩm `{ orderId, productId, rating, comment }`; chỉ cho đơn của chính khách và đơn đã giao; mỗi cặp (orderId, productId) một đánh giá; lỗi `REVIEW_ALREADY_EXISTS` (409), `ORDER_NOT_DELIVERED` (400) | Review |
| GET | `/reviews` | STAFF, ADMIN | Quản lý đánh giá, phản ánh | Review |
| DELETE | `/reviews/:id` | STAFF, ADMIN | Ẩn/xóa đánh giá vi phạm | Review |

Ghi chú cập nhật báo cáo mục 3.2.3:
- Membership: thêm `lifetimePoints` (Number, dùng xét hạng; `pointBalance` là điểm khả dụng).
- Collection mới PointTransaction: `transactionId` (PK), `customerId` (tham chiếu Customer), `orderId` (tùy chọn), `type`, `points`, `balanceAfter`, `note`, `createdAt`.
- Review: thêm unique index ghép (`orderId`, `productId`).
- Đề xuất cần nhóm chốt: 1 điểm cho mỗi 10.000đ của đơn đã giao thành công; hạng xét theo `lifetimePoints` với ngưỡng Thường 0, Bạc 500, Vàng 1.000, Kim cương 3.000.

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
| GET | `/chat/sessions/my` | CUSTOMER | Danh sách phiên chat của tôi (mới nhất trước), kèm tin nhắn cuối và tên nhân viên nếu có | ChatSession, ChatMessage |
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

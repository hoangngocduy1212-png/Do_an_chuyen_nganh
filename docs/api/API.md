# API hiện hành

Tài liệu này mô tả các HTTP endpoint đang được đăng ký bởi `backend/src/app.module.ts` và các module con của nó. Endpoint được thiết kế trong tài liệu cũ nhưng chưa được đăng ký được liệt kê riêng ở cuối, không xem là API có thể gọi.

## Quy ước

- Backend base path: `/api/v1`.
- Swagger runtime: `/api/docs`.
- Thành công được bọc thành `{ "success": true, "data": ... }`; lỗi được bọc theo exception filter thành `{ "success": false, "error": ... }`.
- JWT được gửi trong `Authorization: Bearer <accessToken>`. Guard JWT và RBAC được đăng ký toàn cục; route ghi `Public` không yêu cầu JWT.
- `STAFF` bị giới hạn dữ liệu theo `storeId`/cửa hàng trong JWT ở những service có áp dụng scope đó.
- Trừ khi ghi khác, NestJS mặc định trả HTTP 201 cho `POST`; auth có thiết lập `200` tường minh cho một số route.

## Health

| Method | Path | Quyền | Hành vi |
|---|---|---|---|
| GET | `/health` | Public | Trạng thái backend và timestamp. |

## Auth và người dùng

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| POST | `/auth/register` | Public | Tạo tài khoản CUSTOMER và dữ liệu liên quan; giới hạn 5 lần/giờ. |
| POST | `/auth/login` | Public | Trả access/refresh token; giới hạn 10 lần/phút; HTTP 200. |
| POST | `/auth/refresh` | Public | Xoay refresh token và cấp token mới; HTTP 200. |
| POST | `/auth/logout` | JWT | Thu hồi refresh token nếu gửi trong body; HTTP 200. |
| POST | `/auth/forgot-password` | Public | Yêu cầu email đặt lại; giới hạn 5 lần/giờ; HTTP 200. Gửi mail phụ thuộc cấu hình mail. |
| POST | `/auth/reset-password` | Public | Đặt mật khẩu mới bằng token dùng một lần; HTTP 200. |
| GET | `/users/me` | JWT | Lấy thông tin user hiện tại. |

Hiện chưa có route đang chạy cho cập nhật hồ sơ/địa chỉ/avatar/mật khẩu, quản trị users hoặc CRUD employees. Những API đó có trong bản thiết kế trước nhưng chưa được expose từ module hiện tại.

## Danh mục, sản phẩm, cửa hàng

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/categories` | Public | Liệt kê danh mục. |
| POST | `/categories` | ADMIN, STAFF | Tạo danh mục. |
| PATCH | `/categories/:id` | ADMIN, STAFF | Sửa danh mục. |
| DELETE | `/categories/:id` | ADMIN, STAFF | Xóa danh mục. |
| GET | `/products` | Public | Tìm kiếm/lọc/phân trang; `limit` tối đa 50. |
| GET | `/products/:id` | Public | Chi tiết sản phẩm; `storeId` tùy chọn để nhận tồn kho cửa hàng. |
| POST | `/products` | ADMIN, STAFF | Tạo sản phẩm; ảnh multipart tùy chọn, JPG/PNG/WebP tối đa 2 MB. |
| PATCH | `/products/:id` | ADMIN, STAFF | Cập nhật sản phẩm; ảnh multipart tùy chọn, tối đa 2 MB. |
| GET | `/stores` | Public | Liệt kê cửa hàng. |
| GET | `/stores/:id` | Public | Chi tiết cửa hàng. |
| POST | `/stores` | ADMIN | Tạo cửa hàng. |
| PATCH | `/stores/:id` | ADMIN | Cập nhật cửa hàng. |

### Query sản phẩm

Các query được khai báo trong `ProductQueryDto`:

| Query | Mô tả |
|---|---|
| `q` | Từ khóa tìm kiếm. |
| `categoryId` | Lọc danh mục. |
| `minPrice`, `maxPrice` | Lọc khoảng giá. |
| `storeId` | Tính/lọc theo cửa hàng và tồn kho. |
| `inStock=true\|false` | Lọc còn hàng; có ý nghĩa khi xét tồn cửa hàng. |
| `collection=bestseller\|deals` | Danh sách bán chạy hoặc khuyến mãi. |
| `sort=price\|-price\|-createdAt\|-sold\|-discount` | Sắp xếp theo lựa chọn được hỗ trợ. |
| `page`, `limit` | Phân trang; mặc định 1 và 20, limit tối đa 50. |

Ảnh sản phẩm được lưu trong thư mục `backend/uploads` và phục vụ tại `/uploads/...`.

## Giỏ hàng

Tất cả route yêu cầu role CUSTOMER.

| Method | Path | Hành vi |
|---|---|---|
| GET | `/cart` | Đọc giỏ hiện tại. |
| POST | `/cart/items` | Thêm sản phẩm, kiểm tra cửa hàng, giá và tồn. |
| PATCH | `/cart/items/:itemId` | Đổi số lượng. |
| DELETE | `/cart/items/:itemId` | Xóa một dòng. |
| DELETE | `/cart` | Xóa giỏ. |
| POST | `/cart/validate` | Kiểm tra giỏ với giá/tồn/sản phẩm hiện tại. |

Giỏ gắn với cửa hàng; không thể trộn sản phẩm từ nhiều cửa hàng. Hàng cân theo kg áp dụng bước số lượng 0.5; số lượng cũng bị chặn theo tồn khả dụng.

## Voucher và tồn kho

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/vouchers` | ADMIN | Liệt kê voucher quản trị. |
| GET | `/vouchers/available?orderAmount=...` | CUSTOMER | Voucher khả dụng theo giá trị đơn nếu truyền. |
| POST | `/vouchers/validate` | CUSTOMER | Body gồm `code` và `orderAmount`; trả code và discountAmount. |
| POST | `/vouchers` | ADMIN | Tạo voucher. |
| PATCH | `/vouchers/:id` | ADMIN | Cập nhật voucher. |
| DELETE | `/vouchers/:id` | ADMIN | Xóa voucher. |
| GET | `/inventory` | ADMIN, STAFF | Danh sách tồn; STAFF được giới hạn vào cửa hàng được gán. |
| POST | `/inventory/import` | ADMIN | Nhập tồn. |
| POST | `/inventory/export` | ADMIN | Xuất tồn; không cho xuất vượt tồn khả dụng. |

## Dashboard quản trị

| Method | Path | Quyền | Hành vi |
|---|---|---|---|
| GET | `/admin/dashboard` | ADMIN | Tổng hợp doanh thu payment thành công 6 tháng, số đơn và trạng thái, tồn thấp cùng các chỉ số catalog; trả số document của 26 collection đã khai báo. Chỉ đọc dữ liệu, không tạo collection mới. |

## Đơn hàng

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| POST | `/orders/preview` | CUSTOMER | Body nhận `storeId`, `receiveMethod`, tùy chọn `shippingAddress`, `voucherCode`; tính tổng dự kiến. |
| POST | `/orders` | CUSTOMER | Tạo đơn từ giỏ; bắt buộc header `Idempotency-Key`. Body nhận dữ liệu preview cùng tùy chọn recipient/pickup/note/payment. |
| GET | `/orders/my` | CUSTOMER | Đơn của khách hiện tại, phân trang/lọc. |
| GET | `/orders` | STAFF, ADMIN | Danh sách đơn; STAFF bị giới hạn theo cửa hàng. |
| GET | `/orders/:id` | CUSTOMER, STAFF, ADMIN | Chi tiết đơn; service xác thực quyền truy cập đơn. |
| PATCH | `/orders/:id/shipping-info` | CUSTOMER | Sửa thông tin nhận hàng khi trạng thái cho phép. |
| POST | `/orders/:id/cancel` | CUSTOMER | Hủy đơn khi điều kiện nghiệp vụ cho phép. Body có `reason`. |
| POST | `/orders/:id/return` | CUSTOMER | Gửi yêu cầu trả hàng; body có `reason`, `description`. |
| POST | `/orders/:id/accept` | STAFF, ADMIN | Nhận xử lý đơn. |
| PATCH | `/orders/:id/items/:itemId/weight` | STAFF, ADMIN | Cập nhật khối lượng thực tế hàng cân; body `actualWeight`. |
| PATCH | `/orders/:id/status` | STAFF, ADMIN | Chuyển trạng thái hợp lệ. |

Trạng thái có trong DTO: `PENDING`, `PREPARING`, `SHIPPING`, `READY_FOR_PICKUP`, `DELIVERED`, `CANCELLED`, `RETURNING`, `RETURNED`. Route status cho phép chuyển sang `PREPARING`, `SHIPPING`, `READY_FOR_PICKUP`, `DELIVERED`, `RETURNED`, sau đó service kiểm tra chuyển trạng thái theo nghiệp vụ. Lịch sử vòng đời minh họa ở [activity diagram](../uml/activity/order-lifecycle.md).

## Thanh toán

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| POST | `/payments` | CUSTOMER | Tạo/lấy payment cho đơn. TRANSFER trả dữ liệu QR VietQR; CARD trả URL checkout đã cấu hình; CASH không tạo payment online ở route này. |
| GET | `/payments/:id` | CUSTOMER, STAFF, ADMIN | Xem payment sau khi kiểm tra quyền với đơn. |
| GET | `/orders/:id/payments` | CUSTOMER, STAFF, ADMIN | Lịch sử payment của đơn sau khi kiểm tra quyền. |
| POST | `/payments/:id/refund` | STAFF, ADMIN | Hoàn một phần/toàn phần payment thành công; yêu cầu reason. |
| POST | `/payments/webhook/:provider` | Public tại JWT layer; chữ ký bắt buộc | Kiểm tra header `x-payment-signature` bằng HMAC-SHA256 trên raw body; không phải endpoint cho trình duyệt người dùng. |
| POST | `/payments/mock/:paymentId/confirm` | ADMIN | Chỉ hoạt động ngoài production; dùng kiểm thử/demo, không phải xác nhận của cổng thanh toán thật. |

Thanh toán có xử lý trạng thái và chữ ký nhưng chưa có adapter gọi API ngân hàng/cổng thẻ hoặc vận chuyển thật. `CARD` cần `PAYMENT_CARD_CHECKOUT_URL`; VietQR cần cấu hình thông tin ngân hàng. Đơn online giữ tồn có thời hạn; transaction MongoDB cần replica set.

## AI service

FastAPI hiện expose trực tiếp (không qua backend API):

| Method | Path | Bảo vệ | Trạng thái |
|---|---|---|---|
| GET | `/health` | Public | Health check. |
| POST | `/chat` | `X-Internal-Key` nếu `INTERNAL_API_KEY` được cấu hình | Schema hoạt động; trả câu trả lời mẫu, chưa tích hợp LLM/RAG. |
| POST | `/recommend` | Như trên | Endpoint hoạt động nhưng service trả danh sách rỗng placeholder. |
| POST | `/forecast/run` | Như trên | Endpoint hoạt động nhưng service trả kết quả rỗng placeholder. |

`ai-service` có Mongo connection helper nhưng các service AI hiện chưa gọi helper này. Trong cấu hình development để trống `INTERNAL_API_KEY` thì guard bỏ qua kiểm tra key; cấu hình key để bật kiểm tra.

## Chưa được expose từ backend

Các phần sau có trong API thiết kế cũ hoặc thư mục/schema, nhưng hiện không có controller/module tương ứng được đăng ký trong `AppModule`; không gọi chúng như endpoint có sẵn:

- CRUD users/employees ngoài `GET /users/me`; hồ sơ, địa chỉ, đổi mật khẩu, avatar.
- Membership/điểm thưởng API, review API và quản lý đánh giá.
- Delivery tracking/webhook/fulfillment API.
- Reports/dashboard API.
- Backend chat sessions/messages/knowledge/AI config/feedback/activities/recommendations/forecasts.
- AI client/backend fallback tích hợp với FastAPI.

## Liên hệ tài liệu

- Luồng hiện hành: [use cases](../uml/usecase/current-use-cases.md), [checkout/payment sequence](../uml/sequence/checkout-and-payment.md), [order lifecycle](../uml/activity/order-lifecycle.md).
- Luôn đối chiếu Swagger runtime tại `/api/docs` khi implementation thay đổi.

# Sequence đặt hàng và thanh toán

```mermaid
sequenceDiagram
  autonumber
  actor Customer as Khách hàng
  participant UI as React frontend
  participant API as NestJS Orders API
  participant DB as MongoDB replica set / Atlas
  participant Pay as PaymentsService
  participant Bank as Nhà cung cấp thanh toán

  Customer->>UI: Xem giỏ, chọn cửa hàng/phương thức nhận
  UI->>API: POST /orders/preview
  API->>DB: Đọc Cart, CartItems, Products, Inventory, Voucher
  DB-->>API: Dữ liệu giỏ và giá/tồn hiện tại
  API-->>UI: Subtotal, discount, shipping, total

  Customer->>UI: Xác nhận đặt hàng
  UI->>API: POST /orders + Idempotency-Key
  API->>DB: Tạo session và transaction
  API->>DB: Giữ tồn + ghi Order + OrderItems
  DB-->>API: Commit transaction
  API-->>UI: Order PENDING

  alt Thanh toán chuyển khoản/thẻ
    UI->>API: POST /payments
    API->>DB: Tạo hoặc tái sử dụng Payment PENDING
    API-->>UI: VietQR details hoặc configured payment URL
    Customer->>Bank: Thực hiện thanh toán ngoài ứng dụng
    Bank->>API: POST /payments/webhook/:provider + HMAC signature
    API->>API: Kiểm tra signature, số tiền và tính idempotent
    API->>DB: Cập nhật Payment và Order payment status
    API-->>Bank: Kết quả xử lý webhook
  else Thanh toán CASH
    Note over UI,DB: POST /payments không tạo thanh toán online cho CASH
  end

  Note over API,DB: Transaction đặt hàng cần MongoDB replica set; lỗi hoặc retry vẫn được bảo vệ bởi Idempotency-Key
```

Sơ đồ thể hiện các endpoint hiện có; không biểu thị tích hợp ngân hàng/card provider đã hoàn tất. VietQR được tạo thành dữ liệu QR; hosted-checkout URL do cấu hình cung cấp. Webhook cần nhà cung cấp gửi đúng raw body và chữ ký.

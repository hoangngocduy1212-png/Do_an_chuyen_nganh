# Use cases đang được expose

Sơ đồ thể hiện khả năng hiện có ở API/backend và các route frontend được đăng ký. Không bao gồm các chức năng mới chỉ có trong bản thiết kế cũ.

```mermaid
flowchart LR
  customer[Khách hàng]
  staff[Nhân viên]
  admin[Quản trị viên]
  provider[Nhà cung cấp thanh toán]

  subgraph api[Backend NestJS API]
    browse((Xem cửa hàng, danh mục, sản phẩm))
    auth((Đăng ký, đăng nhập, refresh, logout))
    profile((Xem hồ sơ hiện tại))
    cart((Quản lý giỏ và kiểm tra giỏ))
    checkout((Preview và đặt đơn))
    payment((Tạo/xem thanh toán))
    cancel((Hủy hoặc yêu cầu trả đơn))
    manageCatalog((Quản lý danh mục, sản phẩm, cửa hàng))
    manageInventory((Xem, nhập và xuất tồn))
    manageOrders((Nhận đơn, cập nhật cân nặng/trạng thái))
    manageVoucher((Quản lý và xác thực voucher))
    webhook((Gửi webhook thanh toán có chữ ký))
  end

  customer --> browse
  customer --> auth
  customer --> profile
  customer --> cart
  customer --> checkout
  customer --> payment
  customer --> cancel
  staff --> manageCatalog
  staff --> manageInventory
  staff --> manageOrders
  admin --> manageCatalog
  admin --> manageInventory
  admin --> manageOrders
  admin --> manageVoucher
  customer --> manageVoucher
  provider --> webhook

```

Lưu ý: use case API không đồng nghĩa đã có màn hình tương ứng. Route `/admin` và `/staff` hiện chỉ mở trang placeholder; xem [API status](../../api/API.md).

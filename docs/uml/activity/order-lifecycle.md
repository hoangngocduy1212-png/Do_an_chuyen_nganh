# Activity vòng đời đơn hàng

```mermaid
stateDiagram-v2
  [*] --> PENDING: Đặt hàng thành công / giữ tồn

  PENDING --> PREPARING: Nhân viên nhận xử lý
  PENDING --> CANCELLED: Khách hủy khi còn đủ điều kiện

  PREPARING --> SHIPPING: Đơn DELIVERY đã sẵn sàng giao
  PREPARING --> READY_FOR_PICKUP: Đơn PICKUP đã sẵn sàng nhận

  READY_FOR_PICKUP --> DELIVERED: Khách nhận tại cửa hàng
  SHIPPING --> DELIVERED: Giao hàng hoàn tất
  DELIVERED --> RETURNING: Khách gửi yêu cầu trả
  RETURNING --> RETURNED: Nhân viên xử lý hoàn trả

  CANCELLED --> [*]
  RETURNED --> [*]
  DELIVERED --> [*]
```

Điều kiện nghiệp vụ được kiểm tra trong service, không chỉ bởi sơ đồ:

- Đặt đơn dùng `Idempotency-Key`, kiểm tra giỏ/tồn và giữ tồn.
- Đơn có thanh toán online còn thiếu tiền không được chuyển sang `DELIVERED`.
- Hàng bán theo cân phải có `actualWeight` trước các chuyển trạng thái yêu cầu hoàn tất chuẩn bị.
- `PICKUP` dùng `READY_FOR_PICKUP`; đơn `DELIVERY` dùng `SHIPPING`.
- Endpoint status hiện chấp nhận `PREPARING`, `SHIPPING`, `READY_FOR_PICKUP`, `DELIVERED`, `RETURNED`; service kiểm tra trạng thái nguồn và điều kiện từng bước.
- `CANCELLED` và `RETURNING` được tạo bởi các hành động nghiệp vụ riêng, không phải giá trị cho phép trong DTO cập nhật status.

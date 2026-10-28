Bạn là senior backend developer NestJS + MongoDB. Hãy xây lớp DỮ LIỆU cho hệ thống "Muadee" (siêu thị B2C). Dùng Mongoose. Tên collection/trường bám báo cáo mục 3.2.3 và docs/api/API.md, cộng phần bổ sung dưới đây. Không đổi enum đã có trong API.md. Kiểu TypeScript đầy đủ, không dùng any.

## 1. Nền tảng
- Mọi collection dùng _id ObjectId. Viết plugin common/database/id-plugin.ts: khi toJSON trả cả `_id` và trường tên theo collection (productId, storeId, categoryId, orderId, ...) dạng chuỗi, bỏ __v, ẩn các trường select:false. Bật timestamps.
- Viết mapper trong từng module để đổi tên cho khớp frontend: Store → { name = storeName, phoneNumber = phone }, Category → categoryName, User → { phoneNumber = phone, avatarUrl = avatar }, CartItem → { itemId, priceAtAdd = price }, PointTransaction → { id, description = note }, ChatMessage.senderType → role (CUSTOMER→user, CHATBOT→assistant, STAFF→staff).
- Đặt schema ở backend/src/modules/<module>/schemas/*.schema.ts, indexes khai báo ngay trong schema.

## 2. 26 collection
Thiết kế: 26 collection (23 cũ + 3 mới)

Mình giữ đúng cấu trúc 23 collection của báo cáo (Cart/CartItem và Order/OrderItem vẫn tách riêng). Bảng dưới chỉ ghi phần thêm hoặc đổi so với mục 3.2.3, vì những gì khác bạn đã có.

Collection	Thêm / đổi
User	avatar, createdAt, refreshTokenHashes[], passwordResetToken, passwordResetExpires (3 trường cuối select:false)
Customer	addresses[] nhúng, tối đa 5: {addressId, label, recipientName, phone, addressLine, isDefault}; address giữ làm bản sao của địa chỉ mặc định
Store	openingHours, deliveryZones[] (danh sách quận/phường phục vụ), shippingFee: {baseFee, freeShipThreshold?} (đề xuất, chờ nhóm chốt)
Membership	lifetimePoints (dùng xét hạng), pointBalance là điểm khả dụng
MembershipLevel (mới)	name, minPoints, benefits, sortOrder (seed: Thường 0, Bạc 500, Vàng 1.000, Kim cương 3.000)
PointTransaction (mới)	customerId, orderId?, type (EARN/REDEEM/ADJUST), points, balanceAfter, note, createdAt
Counter (mới)	_id (ví dụ order-261025), seq; sinh orderCode dạng MD261025014 như mock
Product	salePrice, saleStartDate, saleEndDate, originalPrice?, badge?, avgRating, reviewCount, soldCount (các số này lưu sẵn và cập nhật khi có đánh giá hoặc đơn giao), searchText (tên không dấu, chữ thường); tên danh mục lấy bằng populate
Inventory	reservedQuantity (mặc định 0), lowStockThreshold (mặc định 10); tồn khả dụng = quantity − reservedQuantity
Cart	storeId (giỏ gắn một cửa hàng), updatedAt; CartItem dùng price làm giá lúc thêm
Voucher	usageLimit?, usedCount (mặc định 0), status
Order	orderCode (duy nhất), subtotal, shippingFee, recipientName, recipientPhone, pickupTime?, note?, estimatedDeliveryAt?, paymentMethod và paymentStatus (lưu sẵn để hiển thị danh sách), idempotencyKey, reservationExpiresAt, cancelReason?, returnReason?, statusHistory[{status, at, by}]
OrderItem	Lưu ảnh chụp tại thời điểm đặt: productName, image, unit; thêm lineTotal. quantity là khối lượng ước tính, actualWeight là khối lượng cân thực
Payment	provider, expiresAt (QR 15 phút), transferContent (mã đơn), webhookReceivedAt?
Delivery	events[{time, status, location}] (bản lưu đệm hành trình), estimatedDeliveryAt?
Review	isHidden (nhân viên ẩn đánh giá vi phạm); trạng thái “chờ đánh giá” không lưu mà suy ra từ OrderItem chưa có Review
ChatSession	lastMessageAt, guestToken? (khách vãng lai), handoverRequestedAt?
ChatMessage	senderType dùng mã CUSTOMER/CHATBOT/STAFF; productIds[] (thẻ sản phẩm chatbot gợi ý), sources[] (các knowledgeId), needHandover
UserActivity	anonymousId? cho khách vãng lai
Chỉ mục
Collection	Chỉ mục	Lý do
User	email duy nhất	đăng nhập
Customer, Cart, Membership	userId / customerId duy nhất	quan hệ 1–1
CartItem	(cartId, productId) duy nhất	cộng dồn khi thêm lại
Inventory	(storeId, productId) duy nhất; (storeId, quantity)	tồn kho theo cửa hàng, lọc tồn thấp
Product	(status, categoryId, price); text trên searchText; (saleEndDate)	lọc danh sách, tìm kiếm, ưu đãi
Order	orderCode duy nhất; (customerId, createdAt -1); (storeId, orderStatus, createdAt -1); (customerId, idempotencyKey) duy nhất, partial; (reservationExpiresAt) partial	đơn của tôi, hàng đợi nhân viên, chống đặt trùng, quét đơn hết hạn giữ hàng
OrderItem	orderId; productId	gộp thống kê
Payment	orderId; transactionCode duy nhất, sparse	webhook không xử lý trùng
Delivery	orderId duy nhất	1 đơn tối đa 1 vận đơn
Review	(orderId, productId) duy nhất; (productId, createdAt -1)	mỗi sản phẩm của đơn đánh giá một lần
PointTransaction	(customerId, createdAt -1)	lịch sử điểm
Voucher	code duy nhất; (endDate)	
ChatSession	(status, lastMessageAt -1); (customerId, startedAt -1)	hàng đợi CSKH, lịch sử của tôi
ChatMessage	(sessionId, createdAt)	
UserActivity	(customerId, createdAt -1); TTL 180 ngày	gợi ý, tự dọn dữ liệu
DemandForecast	(storeId, productId, periodStart) duy nhất	
AIConfig	featureKey duy nhất	
KnowledgeDocument	(status, docType); vector index (chỉ Atlas)
Collection mới: MembershipLevel, PointTransaction, Counter.
Quy tắc: Product.searchText tự sinh khi lưu (bỏ dấu tiếng Việt, chữ thường, từ productName và description); Order.statusHistory tự thêm khi đổi orderStatus; orderCode sinh bằng Counter dạng "MD" + yyMMdd + 3 chữ số tăng dần theo ngày (atomic findOneAndUpdate $inc, upsert).

## 3. Chỉ mục
Tạo đúng danh sách chỉ mục: [dán bảng chỉ mục ở trên]. Thêm database/scripts/create-indexes.ts chạy độc lập (autoIndex tắt ở production). TTL 180 ngày cho UserActivity. Vector index cho KnowledgeDocument.embedding chỉ tạo khi MONGODB_URI là Atlas (ghi chú cách tạo trong README), local dùng cosine ở ai-service.

## 4. Tồn kho an toàn
Viết InventoryService.reserve(items, session), release(items, session), commit(items, session) theo thuật toán: updateOne điều kiện (quantity - reservedQuantity >= qty) rồi $inc reservedQuantity; nếu matchedCount = 0 ném OUT_OF_STOCK kèm danh sách thiếu. Dùng MongoDB transaction (session) khi tạo đơn; nếu connection không hỗ trợ transaction (không phải replica set) thì chạy tuần tự và hoàn tác khi lỗi. Viết job @Cron mỗi phút tự hủy đơn có reservationExpiresAt < now chưa thanh toán và release tồn. Viết test (Jest + mongodb-memory-server replica set) cho 20 yêu cầu đặt đồng thời cùng một sản phẩm còn 5, kết quả đúng 5 thành công.

## 5. Seed (database/seed/seed.ts, chạy bằng `npm run seed`, có tham số --reset)
Dùng bộ sinh số ngẫu nhiên có seed cố định để kết quả lặp lại được. Tạo:
- 6 danh mục (Rau củ, Trái cây, Thịt cá, Sữa trứng, Đồ khô, Đồ uống); 3 cửa hàng ACTIVE (Nguyễn Trãi Q.5, Võ Văn Tần Q.3, Phan Xích Long Phú Nhuận) có deliveryZones và shippingFee.
- Khoảng 80 sản phẩm tiếng Việt, đơn vị kg/gói/hộp/chai; một số có salePrice (đang áp dụng và đã hết hạn), 3 sản phẩm image rỗng hoặc link hỏng, vài sản phẩm hàng bán theo kg.
- Inventory đủ 3 cửa hàng × mọi sản phẩm, trong đó có hết hàng, sắp hết, còn nhiều.
- 4 hạng MembershipLevel; tài khoản: admin@muadee.vn, staff@muadee.vn (gắn cửa hàng s1), customer@muadee.vn (hạng Vàng 2.480 điểm, 2 địa chỉ), locked@muadee.vn (LOCKED), cộng 30 khách hàng giả. Mật khẩu dev "Muadee123" băm bcrypt.
- 5 voucher (đang áp dụng, sắp hết hạn, đã hết hạn), 8 đánh giá mẫu.
- 600 đơn hàng trải đều 60 ngày gần nhất, có đủ trạng thái, DELIVERY và PICKUP, CASH/TRANSFER/CARD, có hàng bán theo cân đã cân, Payment, Delivery và PointTransaction tương ứng, nhất quán với Inventory. Mô phỏng quy luật (cuối tuần bán nhiều hơn, rau củ theo mùa) để dự báo có ý nghĩa.
- 30 KnowledgeDocument (FAQ, chính sách giao nhận, đổi trả, khuyến mãi) tiếng Việt; AIConfig 3 chức năng.
- Phải chạy lặp lại không lỗi và in tóm tắt số bản ghi.

## 6. Cập nhật hạ tầng
Sửa docker-compose.yml: mongo chạy replica set một node có healthcheck (theo mẫu), backend/ai-service chờ mongo healthy. Sửa .env.example (MONGODB_URI có replicaSet=rs0 cho Docker, ghi chú URI Atlas và URI chạy ngoài Docker, giữ MONGO_URI cho ai-service). KHÔNG ghi mật khẩu thật vào bất kỳ file nào.

## 7. Đầu ra
Mỗi file một khối code có đường dẫn. Cuối cùng liệt kê package cần cài và lệnh chạy: docker compose up -d mongo, npm run create-indexes, npm run seed -- --reset.
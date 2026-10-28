# Class diagram dữ liệu cốt lõi hiện tại

Đây là mô hình rút gọn từ Mongoose schemas đang có. Các mũi tên là liên kết bằng ID trong document; không khẳng định mọi liên kết được enforce bằng foreign key.

```mermaid
classDiagram
  class User {
    +string userId
    +string fullName
    +string email
    +string phone
    +string role
    +string status
  }
  class Customer {
    +string customerId
    +string userId
    +string address
    +CustomerAddress[] addresses
  }
  class Store {
    +string storeId
    +string storeName
    +string address
    +string status
    +StoreShippingFee shippingFee
  }
  class Category {
    +string categoryId
    +string categoryName
    +string description
  }
  class Product {
    +string productId
    +string categoryId
    +string productName
    +number price
    +number salePrice
    +string status
    +string unit
  }
  class Cart {
    +string cartId
    +string customerId
    +string storeId
    +number totalAmount
  }
  class CartItem {
    +string itemId
    +string cartId
    +string productId
    +number quantity
    +number price
  }
  class Inventory {
    +string inventoryId
    +string storeId
    +string productId
    +number quantity
    +number reservedQuantity
  }
  class Order {
    +string orderId
    +string customerId
    +string storeId
    +string orderStatus
    +string receiveMethod
    +number totalAmount
    +number paidAmount
    +number amountDue
    +string paymentStatus
  }
  class OrderItem {
    +string orderItemId
    +string orderId
    +string productId
    +number quantity
    +number actualWeight
    +number lineTotal
  }
  class Payment {
    +string paymentId
    +string orderId
    +string paymentMethod
    +string paymentStatus
    +number amount
    +string transactionCode
  }
  class Voucher {
    +string voucherId
    +string code
    +string status
  }

  User "1" --> "0..1" Customer : userId
  Customer "1" --> "1" Cart : customerId
  Cart "1" --> "0..*" CartItem : cartId
  Category "1" --> "0..*" Product : categoryId
  Product "1" --> "0..*" Inventory : productId
  Store "1" --> "0..*" Inventory : storeId
  Customer "1" --> "0..*" Order : customerId
  Store "1" --> "0..*" Order : storeId
  Order "1" --> "1..*" OrderItem : orderId
  Order "1" --> "0..*" Payment : orderId
  Product "1" --> "0..*" OrderItem : productId
  Voucher "0..1" --> "0..*" Order : voucherCode
```

Sơ đồ không đưa vào các domain modules chưa đăng ký như review, delivery, membership points, reports, chat và AI configuration.

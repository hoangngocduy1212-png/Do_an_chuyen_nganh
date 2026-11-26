"""Dữ liệu MẪU để chạy thử chat khi chưa có Qdrant/NestJS (DATA_BACKEND=mock).
Không phụ thuộc thư viện ngoài. Giá, tồn kho ở đây chỉ là số giả để thử."""
import re
import unicodedata

PRODUCTS = [
    {"id": "p001", "name": "Táo Envy New Zealand", "category": "Trái cây", "price": 129000, "unit": "kg", "stock": 35,
     "barcode": None, "description": "Táo giòn ngọt, nhập khẩu New Zealand."},
    {"id": "p002", "name": "Chuối già Việt Nam", "category": "Trái cây", "price": 28000, "unit": "kg", "stock": 80,
     "barcode": None, "description": "Chuối già chín tự nhiên, trồng trong nước."},
    {"id": "p003", "name": "Cà chua bi", "category": "Rau củ", "price": 45000, "unit": "kg", "stock": 40,
     "barcode": None, "description": "Cà chua bi ngọt, dùng làm salad."},
    {"id": "p004", "name": "Rau muống", "category": "Rau củ", "price": 15000, "unit": "bó", "stock": 0,
     "barcode": None, "description": "Rau muống tươi, bó khoảng 400g."},
    {"id": "p005", "name": "Cá hồi phi lê Na Uy", "category": "Thủy hải sản", "price": 395000, "unit": "kg", "stock": 12,
     "barcode": None, "description": "Cá hồi phi lê tươi, nhập khẩu Na Uy."},
    {"id": "p006", "name": "Cá basa phi lê", "category": "Thủy hải sản", "price": 85000, "unit": "kg", "stock": 25,
     "barcode": None, "description": "Cá basa phi lê đông lạnh."},
    {"id": "p007", "name": "Sữa tươi Vinamilk không đường 1L", "category": "Sữa", "price": 34000, "unit": "hộp", "stock": 120,
     "barcode": "8934673000015", "description": "Sữa tươi tiệt trùng không đường, hộp 1 lít."},
    {"id": "p008", "name": "Sữa chua Vinamilk có đường (lốc 4 hộp)", "category": "Sữa", "price": 26000, "unit": "lốc", "stock": 60,
     "barcode": "8934673000022", "description": "Sữa chua ăn có đường, lốc 4 hộp 100g."},
    {"id": "p009", "name": "Mì Hảo Hảo tôm chua cay", "category": "Mì ăn liền", "price": 4500, "unit": "gói", "stock": 300,
     "barcode": "8934563000019", "description": "Mì gói vị tôm chua cay, gói 75g."},
    {"id": "p010", "name": "Nước ngọt Coca-Cola lon 330ml", "category": "Nước giải khát", "price": 10500, "unit": "lon", "stock": 200,
     "barcode": "8934588000011", "description": "Nước ngọt có gas, lon 330ml."},
    {"id": "p011", "name": "Dầu ăn Simply đậu nành 1L", "category": "Dầu ăn", "price": 62000, "unit": "chai", "stock": 45,
     "barcode": "8934572000017", "description": "Dầu đậu nành nguyên chất, chai 1 lít."},
    {"id": "p012", "name": "Trứng gà ta (vỉ 10 quả)", "category": "Trứng", "price": 38000, "unit": "vỉ", "stock": 70,
     "barcode": "8934560000018", "description": "Trứng gà ta tươi, vỉ 10 quả."},
]

FAQ = [
    {"title": "Chính sách giao hàng",
     "text": "Giao hàng nội thành trong 2 giờ với đơn từ 200.000đ. Phí giao hàng 15.000đ, miễn phí cho đơn từ 300.000đ."},
    {"title": "Chính sách đổi trả",
     "text": "Đổi trả trong 24 giờ nếu sản phẩm lỗi, hỏng hoặc giao sai. Hàng tươi sống cần có ảnh chụp khi nhận hàng."},
    {"title": "Phương thức thanh toán",
     "text": "Hỗ trợ thanh toán tiền mặt khi nhận hàng, chuyển khoản và ví điện tử."},
    {"title": "Giờ mở cửa",
     "text": "Cửa hàng mở cửa từ 7:00 đến 22:00 mỗi ngày."},
]

_STOP = set("shop co khong gia bao nhieu la cho toi muon mua va cua ban can tim minh ad oi a nhe nha the nao co".split())


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower().replace("đ", "d"))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]", " ", text)


def _tokens(query: str) -> list[str]:
    return [t for t in _norm(query).split() if len(t) > 1 and t not in _STOP]


def _public(p: dict) -> dict:
    return {k: p[k] for k in ("id", "name", "category", "price", "unit", "stock", "description")}


def search_scored(
    query: str, limit: int = 5, category: str | None = None, top_only: bool = False
) -> list[tuple[dict, float]]:
    """Điểm = tỉ lệ từ khóa (khớp nguyên từ, không dấu) của câu hỏi có trong tên/danh mục/mô tả sản phẩm.
    top_only=True chỉ giữ các sản phẩm đạt điểm cao nhất, tránh trả kèm kết quả nhiễu cho chat."""
    toks = _tokens(query)
    if not toks:
        return []
    out = []
    for p in PRODUCTS:
        if category and _norm(category).strip() not in _norm(p["category"]):
            continue
        words = set(_norm(f"{p['name']} {p['category']} {p['description']}").split())
        score = sum(1 for t in toks if t in words) / len(toks)
        if score > 0:
            out.append((_public(p), score))
    out.sort(key=lambda x: -x[1])
    if top_only and out:
        out = [x for x in out if x[1] >= out[0][1]]
    return out[:limit]


def get_by_ids(ids: list[str]) -> list[dict]:
    by_id = {p["id"]: p for p in PRODUCTS}
    return [_public(by_id[i]) for i in ids if i in by_id]


def get_by_barcode(code: str) -> dict | None:
    for p in PRODUCTS:
        if p["barcode"] == code:
            return _public(p)
    return None


def search_knowledge(query: str, limit: int = 3) -> list[dict]:
    toks = _tokens(query)
    scored = []
    for d in FAQ:
        haystack = _norm(f"{d['title']} {d['text']}")
        score = sum(1 for t in toks if t in haystack)
        if score > 0:
            scored.append((score, d))
    scored.sort(key=lambda x: -x[0])
    return [d for _, d in scored[:limit]]


def orders(user_id: str, order_id: str | None = None):
    sample = [
        {"id": "DH1001", "status": "Đang giao", "total": 187000, "items": ["Táo Envy New Zealand 1kg", "Sữa tươi Vinamilk 1L x2"]},
        {"id": "DH1000", "status": "Đã giao", "total": 62000, "items": ["Dầu ăn Simply đậu nành 1L"]},
    ]
    if order_id:
        return next((o for o in sample if o["id"] == order_id), None)
    return sample

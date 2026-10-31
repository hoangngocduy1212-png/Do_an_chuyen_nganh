from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    sessionId: str
    message: str
    storeId: str | None = None
    history: list[ChatMessage] = []
    # Du lieu rieng da duoc backend loc (vi du don hang cua khach). KHONG chua mat khau/thong tin thanh toan.
    customerContext: dict | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[str] = []
    productIds: list[str] = []  # san pham AI goi y; backend se gan thong tin chi tiet
    needHandover: bool = False  # True -> backend chuyen cho nhan vien CSKH

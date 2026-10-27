from app.schemas.chat import ChatRequest, ChatResponse


def answer(req: ChatRequest) -> ChatResponse:
    """TODO (AI - chatbot): lam RAG that.
    1) Tim cac KnowledgeDocument / san pham lien quan toi req.message (tu khoa hoac vector embedding)
    2) Ghep vao prompt cung req.history roi goi LLM (llm_provider trong config)
    3) Neu khong du thong tin -> needHandover=True
    Hien tai tra loi mau de backend va frontend noi duoc."""
    return ChatResponse(
        answer="Xin chào! Trợ lý AI đang được xây dựng. Bạn có thể hỏi về sản phẩm, khuyến mãi hoặc chính sách giao nhận.",
        sources=[],
        needHandover=False,
    )

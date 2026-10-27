from fastapi import APIRouter

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chatbot.service import answer

router = APIRouter(tags=["chatbot"])


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    return answer(req)

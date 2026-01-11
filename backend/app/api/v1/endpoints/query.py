from fastapi import APIRouter, HTTPException
from app.models.schemas import QueryRequest, QueryResponse

router = APIRouter()

@router.post("/ask", response_model=QueryResponse)
async def ask_question(request: QueryRequest):
    """
    Answer a question using semantic search + LLM.
    """
    raise HTTPException(status_code=501, detail="Not implemented yet")

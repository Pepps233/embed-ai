
from fastapi import APIRouter, HTTPException

from app.models.schemas import ChunkEmbeddingRequest, ChunkEmbeddingResponse

router = APIRouter()

@router.post("/embed", response_model=list[ChunkEmbeddingResponse])
async def embed_chunks(request: ChunkEmbeddingRequest):
    """
    Generate embeddings for text chunks.
    Used for short PDFs where client extracts text.
    """
    raise HTTPException(status_code=501, detail="Not implemented yet")

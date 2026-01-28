from fastapi import APIRouter

from app.api.v1.endpoints import documents, embeddings, query

api_router = APIRouter()

api_router.include_router(embeddings.router, prefix="/embeddings", tags=["embeddings"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(query.router, prefix="/query", tags=["query"])

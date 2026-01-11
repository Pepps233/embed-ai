from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class DocumentType(str, Enum):
    WEB_PAGE = "web_page"
    PDF = "pdf"
    EPUB = "epub"

class ProcessingStatus(str, Enum):
    LOCAL = "local"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"

class NoteType(str, Enum):
    SUMMARY = "summary"
    INSIGHT = "insight"
    TODO = "todo"
    QUESTION = "question"

class CreatedFrom(str, Enum):
    MANUAL = "manual"
    SELECTION = "selection"
    AI = "ai"

class TextChunk(BaseModel):
    id: str
    document_id: str
    page_number: Optional[int] = None
    text: str
    char_start: int
    char_end: int
    token_count: int
    vector_id: Optional[str] = None

class ChunkEmbeddingRequest(BaseModel):
    document_id: str
    chunks: List[TextChunk]

class ChunkEmbeddingResponse(BaseModel):
    chunk_id: str
    vector_id: str
    success: bool
    error: Optional[str] = None

class DocumentUploadResponse(BaseModel):
    document_id: str
    status: ProcessingStatus
    message: str

class QueryRequest(BaseModel):
    question: str
    document_ids: Optional[List[str]] = None
    top_k: int = Field(default=5, ge=1, le=20)

class Citation(BaseModel):
    document_id: str
    page_number: Optional[int] = None
    chunk_id: str
    text: str
    relevance_score: float

class QueryResponse(BaseModel):
    answer: str
    citations: List[Citation]
    processing_time_ms: float

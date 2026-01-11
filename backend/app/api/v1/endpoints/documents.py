from fastapi import APIRouter, UploadFile, File, HTTPException
from app.models.schemas import DocumentUploadResponse

router = APIRouter()

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a large PDF for backend processing.
    Triggers full ingestion pipeline.
    """
    raise HTTPException(status_code=501, detail="Not implemented yet")

@router.get("/{document_id}")
async def get_document(document_id: str):
    """
    Retrieve document metadata.
    """
    raise HTTPException(status_code=501, detail="Not implemented yet")

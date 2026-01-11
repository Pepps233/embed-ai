from typing import List, Dict, Any
import io

class PDFProcessor:
    """
    Service for processing large PDFs server-side.
    Uses PyMuPDF or pdfplumber for text extraction.
    """
    
    async def extract_text(self, pdf_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Extract text from PDF, returning page-by-page content.
        
        Returns:
            List of dicts with keys: page_number, text, char_start, char_end
        """
        raise NotImplementedError("PDF processor not yet implemented")
    
    async def get_metadata(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """Extract PDF metadata (title, author, page count, etc.)"""
        raise NotImplementedError("PDF processor not yet implemented")

pdf_processor = PDFProcessor()

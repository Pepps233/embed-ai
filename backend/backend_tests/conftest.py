import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """FastAPI test client fixture."""
    return TestClient(app)


@pytest.fixture
def sample_document_data():
    """Sample document data for testing."""
    return {
        "title": "Test Document",
        "source": "https://example.com/test",
        "content": "This is test content for the document.",
        "metadata": {
            "author": "Test Author",
            "date": "2024-01-01"
        }
    }


@pytest.fixture
def sample_highlight_data():
    """Sample highlight data for testing."""
    return {
        "text": "This is highlighted text",
        "startOffset": 0,
        "endOffset": 23,
        "color": "#FFEB3B",
        "note": "Test note"
    }

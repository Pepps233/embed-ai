import pytest


@pytest.mark.unit
def test_document_data_validation(sample_document_data):
    """Test document data structure is valid."""
    assert "title" in sample_document_data
    assert "source" in sample_document_data
    assert "content" in sample_document_data
    assert isinstance(sample_document_data["metadata"], dict)


@pytest.mark.unit
def test_highlight_data_validation(sample_highlight_data):
    """Test highlight data structure is valid."""
    assert "text" in sample_highlight_data
    assert "startOffset" in sample_highlight_data
    assert "endOffset" in sample_highlight_data
    assert sample_highlight_data["startOffset"] < sample_highlight_data["endOffset"]
    assert isinstance(sample_highlight_data["color"], str)

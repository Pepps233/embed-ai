import os
import pytest
from pinecone import Pinecone


@pytest.mark.integration
def test_pinecone_connection():
    """Test Pinecone connection can be established."""
    api_key = os.getenv('PINECONE_API_KEY')
    
    if not api_key:
        pytest.skip("Pinecone API key not configured")
    
    pc = Pinecone(api_key=api_key)
    assert pc is not None


@pytest.mark.integration
def test_pinecone_list_indexes():
    """Test Pinecone can list indexes."""
    api_key = os.getenv('PINECONE_API_KEY')
    
    if not api_key:
        pytest.skip("Pinecone API key not configured")
    
    pc = Pinecone(api_key=api_key)
    
    try:
        indexes = pc.list_indexes()
        assert indexes is not None
    except Exception as e:
        pytest.fail(f"Failed to list indexes: {str(e)}")


@pytest.mark.integration
@pytest.mark.slow
def test_pinecone_index_access():
    """Test Pinecone index can be accessed."""
    api_key = os.getenv('PINECONE_API_KEY')
    index_name = os.getenv('PINECONE_INDEX_NAME', 'knowledge-companion')
    
    if not api_key:
        pytest.skip("Pinecone API key not configured")
    
    pc = Pinecone(api_key=api_key)
    indexes = pc.list_indexes()
    
    if not any(idx.name == index_name for idx in indexes):
        pytest.skip(f"Index '{index_name}' not found")
    
    index = pc.Index(index_name)
    stats = index.describe_index_stats()
    
    assert 'dimension' in stats
    assert 'total_vector_count' in stats

import os
import pytest
from supabase import create_client, Client


@pytest.mark.integration
def test_supabase_connection():
    """Test Supabase connection can be established."""
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_ANON_KEY')
    
    if not url or not key:
        pytest.skip("Supabase credentials not configured")
    
    supabase: Client = create_client(url, key)
    assert supabase is not None


@pytest.mark.integration
def test_supabase_storage_access():
    """Test Supabase storage is accessible."""
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_ANON_KEY')
    
    if not url or not key:
        pytest.skip("Supabase credentials not configured")
    
    supabase: Client = create_client(url, key)
    
    try:
        buckets = supabase.storage.list_buckets()
        assert buckets is not None
    except Exception as e:
        pytest.fail(f"Storage access failed: {str(e)}")

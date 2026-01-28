import pytest
from fastapi.testclient import TestClient


@pytest.mark.unit
def test_root_endpoint(client: TestClient):
    """Test root endpoint returns correct response."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data
    assert data["version"] == "0.1.0"


@pytest.mark.unit
def test_health_check(client: TestClient):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.unit
def test_cors_headers(client: TestClient):
    """Test CORS headers are present."""
    response = client.options("/health")
    assert response.status_code == 200

import pytest
from fastapi.testclient import TestClient


@pytest.mark.unit
def test_root_endpoint(client: TestClient):
    """Test root endpoint returns correct response."""
    # Fake get request to root endpoint
    response = client.get("/")
    assert response.status_code == 200
    # Convert JSON response body into python dict
    data = response.json()
    assert "message" in data
    assert "version" in data
    assert data["version"] == "0.1.0"


# Ensuring service is up
@pytest.mark.unit
def test_health_check(client: TestClient):
    """Test health check endpoint."""
    # Fake get request to health endpoint
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


# Ensuring API allows for cross-origin requests
@pytest.mark.unit
def test_cors_headers(client: TestClient):
    """Test CORS headers are present."""
    response = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers

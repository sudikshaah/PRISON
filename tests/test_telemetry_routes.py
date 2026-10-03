"""
Unit tests for FastAPI Telemetry endpoints and Clerk authentication protection (`services/telemetry/main.py`).
"""

import pytest
import jwt
from fastapi.testclient import TestClient
from services.telemetry.main import app

client = TestClient(app)


def test_public_routes():
    """Verify that public health-check routes are accessible without auth."""
    res_root = client.get("/")
    assert res_root.status_code == 200
    assert res_root.json()["status"] == "ONLINE"

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"


def test_protected_routes_unauthenticated():
    """Verify that protected telemetry endpoints reject unauthenticated requests with 401."""
    res_get = client.get("/api/v1/telemetry/events")
    assert res_get.status_code == 401
    assert "missing" in res_get.json()["detail"].lower()

    payload = {
        "sandbox_id": "sbx_unauth_test",
        "repo_name": "PRISON/PRISON",
        "pr_number": 1,
        "commit_sha": "sha123",
        "status": "RUNNING",
        "total_events": 0,
    }
    res_post = client.post("/api/v1/telemetry/events", json=payload)
    assert res_post.status_code == 401
    assert "missing" in res_post.json()["detail"].lower()


def test_protected_routes_invalid_token():
    """Verify that protected endpoints reject invalid tokens with 401."""
    headers = {"Authorization": "Bearer invalid.jwt.token"}
    res_get = client.get("/api/v1/telemetry/events", headers=headers)
    assert res_get.status_code == 401


def test_protected_routes_authenticated():
    """Verify that protected endpoints accept requests with a valid Bearer token."""
    valid_token = jwt.encode({"sub": "user_2clerk_authenticated_999"}, "secret", algorithm="HS256")
    headers = {"Authorization": f"Bearer {valid_token}"}

    payload = {
        "sandbox_id": "sbx_authenticated_test",
        "repo_name": "PRISON/PRISON",
        "pr_number": 42,
        "commit_sha": "a1b2c3d4e5f67890",
        "status": "RUNNING",
        "total_events": 1,
        "events": [],
    }

    # Test POST /api/v1/telemetry/events with authentication
    res_post = client.post("/api/v1/telemetry/events", json=payload, headers=headers)
    assert res_post.status_code == 201
    data = res_post.json()
    assert data["status"] == "INGESTED"
    assert data["sandbox_id"] == "sbx_authenticated_test"

    # Test GET /api/v1/telemetry/events with authentication
    res_get = client.get("/api/v1/telemetry/events", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["count"] >= 1

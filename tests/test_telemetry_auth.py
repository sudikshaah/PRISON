"""
Unit tests for Clerk Authentication module in services/telemetry/auth.py.
"""

import os
import pytest
import jwt
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from services.telemetry.auth import get_current_user, get_clerk_sdk


@pytest.mark.asyncio
async def test_missing_token():
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(None)
    assert exc_info.value.status_code == 401
    assert "missing" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_invalid_token():
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid_jwt_token_string")
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_valid_token():
    token = jwt.encode({"sub": "user_2test_clerk_123"}, "secret", algorithm="HS256")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    user_id = await get_current_user(credentials)
    assert user_id == "user_2test_clerk_123"


def test_clerk_sdk_initialization(monkeypatch):
    monkeypatch.setenv("CLERK_SECRET_KEY", "sk_test_mock_key_123")
    sdk = get_clerk_sdk()
    assert sdk is not None

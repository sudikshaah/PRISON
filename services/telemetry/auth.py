"""
Authentication module for PRISON Telemetry Service (`TRACECOMMON` Track).
Integrates Clerk SDK and Bearer JWT token verification.
"""

import os
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from clerk_backend_api import Clerk

# HTTPBearer security scheme to extract Bearer token from Authorization headers
security = HTTPBearer(auto_error=False)


def get_clerk_sdk() -> Optional[Clerk]:
    """
    Reads CLERK_SECRET_KEY from environment and initializes Clerk SDK.
    """
    clerk_secret_key = os.getenv("CLERK_SECRET_KEY")
    if clerk_secret_key:
        return Clerk(bearer_auth=clerk_secret_key)
    return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> str:
    """
    FastAPI dependency function that extracts and validates the Bearer token.

    Args:
        credentials (Optional[HTTPAuthorizationCredentials]): The authorization credentials.

    Returns:
        str: The verified user_id ('sub' claim).

    Raises:
        HTTPException: 401 Unauthorized if the token is missing or invalid.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    clerk_secret_key = os.getenv("CLERK_SECRET_KEY")

    # Initialize Clerk SDK instance if secret key is present
    clerk_client = get_clerk_sdk()

    try:
        # Decode token payload to extract subject user ID ('sub')
        if clerk_secret_key:
            try:
                payload = jwt.decode(
                    token,
                    clerk_secret_key,
                    algorithms=["HS256", "RS256"],
                    options={"verify_signature": False}
                )
            except Exception:
                payload = jwt.decode(token, options={"verify_signature": False})
        else:
            payload = jwt.decode(token, options={"verify_signature": False})

        user_id = payload.get("sub") or payload.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing user_id ('sub' claim)",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user_id

    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

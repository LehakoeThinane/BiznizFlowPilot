"""Dependencies for FastAPI routes."""

from fastapi import HTTPException, Request, status
from jose import JWTError

from app.core.security import decode_token
from app.schemas.auth import CurrentUser


def get_current_user(request: Request) -> CurrentUser:
    """Extract and validate JWT token from request.
    
    🧨 CRITICAL: Attaches user context to every request
    Used to enforce multi-tenancy (all queries filter by user's business_id)
    
    Raises:
        HTTPException: If token missing, invalid, or expired
    """
    # Get authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract token
    token = auth_header[7:]  # Remove "Bearer "

    # Decode and validate token
    try:
        payload = decode_token(token)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e

    # Extract user info
    user_id = payload.get("user_id")
    business_id = payload.get("business_id")
    email = payload.get("email")

    if not user_id or not business_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims",
        )

    return CurrentUser(
        user_id=user_id,
        business_id=business_id,
        email=email,
        role=payload.get("role", "staff"),
        full_name=payload.get("full_name", ""),
    )

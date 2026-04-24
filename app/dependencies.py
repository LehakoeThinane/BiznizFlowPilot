"""Dependencies for FastAPI routes."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.schemas.auth import CurrentUser


def get_current_user(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> CurrentUser:
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

    try:
        user_uuid = UUID(str(user_id))
        business_uuid = UUID(str(business_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims",
        ) from exc

    # Authoritative role/user state comes from the DB.
    # This prevents stale tokens without role claims from downgrading users to "staff".
    user = (
        db.query(User)
        .filter(
            User.id == user_uuid,
            User.business_id == business_uuid,
            User.email == email,
            User.is_active.is_(True),
        )
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return CurrentUser(
        user_id=str(user.id),
        business_id=str(user.business_id),
        email=user.email,
        role=user.role,
        full_name=user.full_name,
    )

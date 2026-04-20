"""Authentication schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    """Request body for user registration."""

    business_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr = Field(..., description="Business email")
    password: str = Field(..., min_length=8, description="Password (min 8 chars)")
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)


class LoginRequest(BaseModel):
    """Request body for user login."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    """User response (no password)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool

class CurrentUser(BaseModel):
    """Current authenticated user info (from JWT)."""

    user_id: UUID
    business_id: UUID
    email: str
    role: str
    full_name: str

"""Event request/response schemas."""

from datetime import datetime
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field


class EventCreate(BaseModel):
    """Create event request."""

    event_type: str = Field(..., min_length=1, max_length=100)
    entity_type: str = Field(..., min_length=1, max_length=50)
    entity_id: UUID
    actor_id: Optional[UUID] = None
    description: Optional[str] = Field(None, max_length=500)
    data: Optional[dict[str, Any]] = None


class EventUpdate(BaseModel):
    """Update event (mark as processed)."""

    processed: Optional[bool] = None


class EventResponse(BaseModel):
    """Event response."""

    id: UUID
    business_id: UUID
    actor_id: Optional[UUID] = None
    event_type: str
    entity_type: str
    entity_id: UUID
    description: Optional[str] = None
    data: Optional[dict[str, Any]] = None
    processed: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    """List of events response."""

    items: list[EventResponse]
    total: int
    skip: int
    limit: int

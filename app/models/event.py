"""Event model - audit and workflow trigger tracking."""

from sqlalchemy import Column, String, Boolean, JSON, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class Event(BaseModel):
    """Event entity.
    
    Tracks all business actions (lead created, task assigned, etc.)
    for audit logging and workflow orchestration.
    Belongs to a business (multi-tenant).
    """

    __tablename__ = "events"

    business_id = Column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
        doc="Tenant ID - CRITICAL FOR MULTI-TENANCY",
    )

    actor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="User who triggered the event",
    )

    event_type = Column(
        String(100),
        nullable=False,
        index=True,
        doc="Event type: lead_created, lead_status_changed, task_created, task_assigned, task_completed",
    )

    entity_type = Column(
        String(50),
        nullable=False,
        index=True,
        doc="Entity type: lead, task, customer, workflow_run",
    )

    entity_id = Column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
        doc="ID of the entity that triggered the event",
    )

    description = Column(
        String(500),
        nullable=True,
        doc="Human-readable event description",
    )

    data = Column(
        JSON,
        nullable=True,
        doc="Event metadata (old status, new status, assigned user, etc.)",
    )

    processed = Column(
        Boolean,
        default=False,
        index=True,
        doc="Whether this event has been processed by workflow engine",
    )

    def __repr__(self) -> str:
        """String representation."""
        return f"<Event id={self.id} type='{self.event_type}' processed={self.processed}>"

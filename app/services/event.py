"""Event service - event creation and processing."""

from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.event import Event
from app.repositories.event import EventRepository
from app.schemas.event import EventCreate, EventUpdate
from app.schemas.auth import CurrentUser


class EventService:
    """Event service with event creation and processing.
    
    Events are the foundation for the workflow orchestration system.
    All business actions (lead created, task assigned, etc.) create events.
    Events are then processed asynchronously by the workflow engine.
    """

    def __init__(self, db: Session):
        """Initialize service."""
        self.db = db
        self.repo = EventRepository(db)

    def create(self, business_id: UUID, current_user: CurrentUser, data: EventCreate) -> Event:
        """Create event.
        
        Events are created automatically by services when business actions occur.
        Can also be created manually via API.
        """
        return self.repo.create(
            business_id=business_id,
            actor_id=current_user.user_id if current_user else None,
            **data.dict(),
        )

    def create_event(
        self,
        business_id: UUID,
        event_type: str,
        entity_type: str,
        entity_id: UUID,
        actor_id: Optional[UUID] = None,
        description: Optional[str] = None,
        data: Optional[dict[str, Any]] = None,
    ) -> Event:
        """Create event from internal service methods.
        
        Called by other services (LeadService, TaskService) when business actions occur.
        This allows services to emit events without requiring a request context.
        """
        return self.repo.create(
            business_id=business_id,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            actor_id=actor_id,
            description=description,
            data=data,
            processed=False,
        )

    def get(self, business_id: UUID, current_user: CurrentUser, event_id: UUID) -> Event | None:
        """Get event by ID.
        
        🧨 All roles can view events in their business.
        """
        return self.repo.get(business_id=business_id, entity_id=event_id)

    def list(self, business_id: UUID, current_user: CurrentUser, skip: int = 0, limit: int = 100) -> tuple[list[Event], int]:
        """List events.
        
        🧨 All roles can view events in their business.
        """
        events = self.repo.list(business_id=business_id, skip=skip, limit=limit)
        total = self.repo.count(business_id=business_id)
        return events, total

    def list_by_type(self, business_id: UUID, current_user: CurrentUser, event_type: str, skip: int = 0, limit: int = 100) -> tuple[list[Event], int]:
        """List events by type.
        
        🧨 All roles can view events.
        """
        events = self.repo.get_by_event_type(business_id=business_id, event_type=event_type, skip=skip, limit=limit)
        total = self.repo.count_by_event_type(business_id=business_id, event_type=event_type)
        return events, total

    def list_by_entity(
        self,
        business_id: UUID,
        current_user: CurrentUser,
        entity_type: str,
        entity_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[Event], int]:
        """List events for entity (lead, task, etc.).
        
        🧨 Useful for viewing audit trail of a specific lead or task.
        """
        events = self.repo.get_by_entity(business_id=business_id, entity_type=entity_type, entity_id=entity_id, skip=skip, limit=limit)
        total = self.repo.count_by_entity(business_id=business_id, entity_type=entity_type, entity_id=entity_id)
        return events, total

    def list_unprocessed(self, business_id: UUID, current_user: CurrentUser, skip: int = 0, limit: int = 100) -> tuple[list[Event], int]:
        """List unprocessed events (for workflow engine).
        
        🧨 RBAC: Only owner/manager can access unprocessed events.
        """
        if current_user.role not in ["owner", "manager"]:
            raise ValueError("Permission denied: Only owner/manager can view unprocessed events")

        events = self.repo.get_unprocessed(business_id=business_id, skip=skip, limit=limit)
        total = self.repo.count_unprocessed(business_id=business_id)
        return events, total

    def mark_processed(self, business_id: UUID, current_user: CurrentUser, event_id: UUID) -> Event | None:
        """Mark event as processed by workflow engine.
        
        🧨 RBAC: Only owner/manager can mark events as processed.
        """
        if current_user.role not in ["owner", "manager"]:
            raise ValueError("Permission denied: Only owner/manager can mark events as processed")

        event = self.repo.get(business_id=business_id, entity_id=event_id)
        if not event:
            return None

        return self.repo.update(business_id=business_id, entity_id=event_id, processed=True)

    def get_audit_trail(self, business_id: UUID, current_user: CurrentUser, entity_type: str, entity_id: UUID) -> dict:
        """Get full audit trail for an entity.
        
        Returns all events related to a lead/task with full metadata.
        """
        events, total = self.list_by_entity(business_id, current_user, entity_type, entity_id, limit=1000)
        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "event_count": total,
            "events": events,
        }

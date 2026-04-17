"""Event repository - data access layer."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.event import Event
from app.repositories.base import BaseRepository


class EventRepository(BaseRepository[Event]):
    """Event repository with business_id filtering.
    
    🧨 CRITICAL: Every method automatically filters by business_id.
    """

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(db, Event)

    def get_by_event_type(self, business_id: UUID, event_type: str, skip: int = 0, limit: int = 100) -> list[Event]:
        """Get events by type within business.
        
        🧨 CRITICAL: Filters by business_id to prevent data leaks.
        """
        return self.db.query(Event).filter(
            Event.business_id == business_id,
            Event.event_type == event_type,
        ).order_by(Event.created_at.desc()).offset(skip).limit(limit).all()

    def count_by_event_type(self, business_id: UUID, event_type: str) -> int:
        """Count events by type within business.
        
        🧨 CRITICAL: Filters by business_id.
        """
        return self.db.query(Event).filter(
            Event.business_id == business_id,
            Event.event_type == event_type,
        ).count()

    def get_by_entity(self, business_id: UUID, entity_type: str, entity_id: UUID, skip: int = 0, limit: int = 100) -> list[Event]:
        """Get events for entity within business.
        
        🧨 CRITICAL: Filters by business_id.
        """
        return self.db.query(Event).filter(
            Event.business_id == business_id,
            Event.entity_type == entity_type,
            Event.entity_id == entity_id,
        ).order_by(Event.created_at.desc()).offset(skip).limit(limit).all()

    def count_by_entity(self, business_id: UUID, entity_type: str, entity_id: UUID) -> int:
        """Count events for entity within business.
        
        🧨 CRITICAL: Filters by business_id.
        """
        return self.db.query(Event).filter(
            Event.business_id == business_id,
            Event.entity_type == entity_type,
            Event.entity_id == entity_id,
        ).count()

    def get_unprocessed(self, business_id: UUID, skip: int = 0, limit: int = 100) -> list[Event]:
        """Get unprocessed events within business.
        
        🧨 CRITICAL: Filters by business_id.
        """
        return self.db.query(Event).filter(
            Event.business_id == business_id,
            Event.processed == False,
        ).order_by(Event.created_at.asc()).offset(skip).limit(limit).all()

    def count_unprocessed(self, business_id: UUID) -> int:
        """Count unprocessed events within business.
        
        🧨 CRITICAL: Filters by business_id.
        """
        return self.db.query(Event).filter(
            Event.business_id == business_id,
            Event.processed == False,
        ).count()

    def get_by_actor(self, business_id: UUID, actor_id: UUID, skip: int = 0, limit: int = 100) -> list[Event]:
        """Get events triggered by user within business.
        
        🧨 CRITICAL: Filters by business_id.
        """
        return self.db.query(Event).filter(
            Event.business_id == business_id,
            Event.actor_id == actor_id,
        ).order_by(Event.created_at.desc()).offset(skip).limit(limit).all()

    def count_by_actor(self, business_id: UUID, actor_id: UUID) -> int:
        """Count events triggered by user within business.
        
        🧨 CRITICAL: Filters by business_id.
        """
        return self.db.query(Event).filter(
            Event.business_id == business_id,
            Event.actor_id == actor_id,
        ).count()

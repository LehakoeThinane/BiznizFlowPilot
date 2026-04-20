"""Event dispatch worker flow and Celery tasks."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.enums import EventStatus
from app.core.database import SessionLocal
from app.services.event import EventService
from app.workflow_engine.definition_provider import DefinitionProvider
from app.workflow_engine import InMemoryDefinitionProvider, WorkflowDispatcher
from app.workers.celery_app import celery_app


logger = logging.getLogger(__name__)

# Phase-4 default provider. Phase-6 can swap in a DB-backed provider.
definition_provider = InMemoryDefinitionProvider()


def process_next_event_for_business(
    db: Session,
    business_id: UUID,
    worker_id: str,
    provider: DefinitionProvider | None = None,
) -> dict[str, object]:
    """Claim one event, dispatch matching definitions, and commit the outcome."""
    event_service = EventService(db)

    event = event_service.claim_next_event(business_id=business_id, worker_id=worker_id)
    if event is None:
        return {
            "claimed": False,
            "runs_created": 0,
            "event_id": None,
            "event_status": None,
        }

    dispatcher = WorkflowDispatcher(db=db, definition_provider=provider or definition_provider)

    try:
        runs = dispatcher.dispatch(event)
        event.status = EventStatus.DISPATCHED
        event.locked_at = None
        event.claimed_by = None
        db.commit()

        return {
            "claimed": True,
            "runs_created": len(runs),
            "event_id": str(event.id),
            "event_status": event.status.value,
        }
    except Exception:
        db.rollback()
        db.refresh(event)
        event.status = EventStatus.FAILED
        event.locked_at = None
        event.claimed_by = None
        db.commit()

        raise


@celery_app.task(bind=True, name="workflows.dispatch_next_event")
def dispatch_next_event_task(self, business_id: str, worker_id: str | None = None) -> dict[str, object]:
    """Celery task wrapper for event dispatch loop."""
    business_uuid = UUID(business_id)
    resolved_worker_id = worker_id or self.request.id or "celery-worker"

    with SessionLocal() as db:
        return process_next_event_for_business(
            db=db,
            business_id=business_uuid,
            worker_id=resolved_worker_id,
            provider=definition_provider,
        )


@celery_app.task(name="workflows.release_stale_claims")
def release_stale_claims_task(business_id: str, stale_after_minutes: int = 10) -> dict[str, int | str]:
    """Periodic recovery task to requeue stale claimed events."""
    business_uuid = UUID(business_id)

    with SessionLocal() as db:
        service = EventService(db)
        released = service.release_stale_claims(
            business_id=business_uuid,
            stale_after_minutes=stale_after_minutes,
        )
        db.commit()

    logger.warning(
        "Released %d stale event claims older than %d minutes for business %s",
        released,
        stale_after_minutes,
        business_id,
    )

    return {
        "business_id": business_id,
        "released": released,
    }

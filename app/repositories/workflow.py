"""Workflow repositories for data access."""

from __future__ import annotations

from typing import Any, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.enums import EventType, WorkflowRunStatus
from app.models import Workflow, WorkflowAction, WorkflowDefinition, WorkflowRun
from app.repositories.base import BaseRepository


def _normalize_run_status(value: WorkflowRunStatus | str) -> WorkflowRunStatus:
    """Support legacy status names while moving to the phase-4 lifecycle."""
    if isinstance(value, WorkflowRunStatus):
        return value

    normalized = value.lower().strip()
    legacy_map = {
        "pending": WorkflowRunStatus.QUEUED,
        "success": WorkflowRunStatus.COMPLETED,
    }
    if normalized in legacy_map:
        return legacy_map[normalized]

    return WorkflowRunStatus(normalized)


class WorkflowRepository(BaseRepository[Workflow]):
    """Workflow repository with multi-tenant enforcement."""

    def __init__(self, db: Session):
        super().__init__(db, Workflow)

    def _session(self, db: Session | None) -> Session:
        return db or self.db

    def get(self, db: Session | None, business_id: UUID, workflow_id: UUID) -> Optional[Workflow]:
        session = self._session(db)
        return (
            session.query(Workflow)
            .filter(
                Workflow.business_id == business_id,
                Workflow.id == workflow_id,
            )
            .first()
        )

    def list(self, db: Session | None, business_id: UUID, skip: int = 0, limit: int = 100) -> List[Workflow]:
        session = self._session(db)
        return (
            session.query(Workflow)
            .filter(Workflow.business_id == business_id)
            .order_by(Workflow.order.asc(), Workflow.created_at.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_event_type(self, db: Session | None, business_id: UUID, event_type: str) -> List[Workflow]:
        session = self._session(db)
        return (
            session.query(Workflow)
            .filter(
                Workflow.business_id == business_id,
                Workflow.trigger_event_type == event_type,
                Workflow.enabled.is_(True),
            )
            .order_by(Workflow.order.asc())
            .all()
        )

    def get_all_enabled(self, db: Session | None, business_id: UUID) -> List[Workflow]:
        session = self._session(db)
        return (
            session.query(Workflow)
            .filter(
                Workflow.business_id == business_id,
                Workflow.enabled.is_(True),
            )
            .order_by(Workflow.order.asc())
            .all()
        )

    def toggle_enabled(
        self,
        db: Session | None,
        business_id: UUID,
        workflow_id: UUID,
        enabled: bool,
    ) -> Optional[Workflow]:
        session = self._session(db)
        workflow = self.get(session, business_id, workflow_id)
        if workflow is None:
            return None

        workflow.enabled = enabled
        session.commit()
        session.refresh(workflow)
        return workflow


class WorkflowDefinitionRepository(BaseRepository[WorkflowDefinition]):
    """Workflow definition repository for dispatcher matching."""

    def __init__(self, db: Session):
        super().__init__(db, WorkflowDefinition)

    def _session(self, db: Session | None) -> Session:
        return db or self.db

    def get_definitions_for_event(
        self,
        db: Session | None,
        business_id: UUID,
        event_type: EventType,
    ) -> List[WorkflowDefinition]:
        session = self._session(db)
        return (
            session.query(WorkflowDefinition)
            .filter(
                WorkflowDefinition.business_id == business_id,
                WorkflowDefinition.event_type == event_type,
            )
            .order_by(WorkflowDefinition.created_at.asc())
            .all()
        )


class WorkflowActionRepository(BaseRepository[WorkflowAction]):
    """Workflow action repository."""

    def __init__(self, db: Session):
        super().__init__(db, WorkflowAction)

    def _session(self, db: Session | None) -> Session:
        return db or self.db

    def get_by_workflow(
        self,
        db_or_workflow_id: Session | UUID,
        workflow_id: UUID | None = None,
    ) -> List[WorkflowAction]:
        """Get actions by workflow.

        Supports both call styles:
        - get_by_workflow(db, workflow_id)
        - get_by_workflow(workflow_id)
        """
        if workflow_id is None:
            session = self.db
            workflow_id = db_or_workflow_id  # type: ignore[assignment]
        else:
            session = db_or_workflow_id  # type: ignore[assignment]

        return (
            session.query(WorkflowAction)
            .filter(WorkflowAction.workflow_id == workflow_id)
            .order_by(WorkflowAction.order.asc())
            .all()
        )

    def delete_by_workflow(self, db: Session | None, workflow_id: UUID) -> int:
        session = self._session(db)
        deleted = session.query(WorkflowAction).filter(WorkflowAction.workflow_id == workflow_id).delete()
        session.commit()
        return int(deleted or 0)


class WorkflowRunRepository(BaseRepository[WorkflowRun]):
    """Workflow run repository with multi-tenant enforcement."""

    def __init__(self, db: Session):
        super().__init__(db, WorkflowRun)

    def _session(self, db: Session | None) -> Session:
        return db or self.db

    def get(self, db: Session | None, business_id: UUID, run_id: UUID) -> Optional[WorkflowRun]:
        session = self._session(db)
        return (
            session.query(WorkflowRun)
            .filter(
                WorkflowRun.business_id == business_id,
                WorkflowRun.id == run_id,
            )
            .first()
        )

    def list(self, db: Session | None, business_id: UUID, skip: int = 0, limit: int = 100) -> List[WorkflowRun]:
        session = self._session(db)
        return (
            session.query(WorkflowRun)
            .filter(WorkflowRun.business_id == business_id)
            .order_by(WorkflowRun.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_workflow(
        self,
        db: Session | None,
        business_id: UUID,
        workflow_id: UUID,
        limit: int = 100,
    ) -> List[WorkflowRun]:
        session = self._session(db)
        return (
            session.query(WorkflowRun)
            .filter(
                WorkflowRun.business_id == business_id,
                WorkflowRun.workflow_id == workflow_id,
            )
            .order_by(WorkflowRun.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_by_status(
        self,
        db: Session | None,
        business_id: UUID,
        status: WorkflowRunStatus | str,
        limit: int = 100,
    ) -> List[WorkflowRun]:
        session = self._session(db)
        normalized = _normalize_run_status(status)
        return (
            session.query(WorkflowRun)
            .filter(
                WorkflowRun.business_id == business_id,
                WorkflowRun.status == normalized,
            )
            .order_by(WorkflowRun.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_pending(self, db: Session | None, business_id: UUID) -> List[WorkflowRun]:
        return self.get_by_status(db, business_id, WorkflowRunStatus.QUEUED)

    def get_failed(self, db: Session | None, business_id: UUID, limit: int = 100) -> List[WorkflowRun]:
        return self.get_by_status(db, business_id, WorkflowRunStatus.FAILED, limit)

    def create_from_definition(
        self,
        db: Session | None,
        *,
        business_id: UUID,
        event_id: UUID,
        workflow_definition_id: UUID,
        actor_id: UUID | None,
        definition_snapshot: dict[str, Any],
        workflow_id: UUID | None = None,
        status: WorkflowRunStatus = WorkflowRunStatus.QUEUED,
    ) -> WorkflowRun:
        """Create a workflow run without committing transaction boundaries."""
        session = self._session(db)
        run = WorkflowRun(
            workflow_id=workflow_id,
            workflow_definition_id=workflow_definition_id,
            business_id=business_id,
            event_id=event_id,
            actor_id=actor_id,
            status=status,
            definition_snapshot=definition_snapshot,
            results={},
        )
        session.add(run)
        session.flush()
        return run

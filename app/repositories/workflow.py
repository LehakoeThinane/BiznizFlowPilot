"""Workflow repository for data access."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import Workflow, WorkflowAction, WorkflowRun
from app.repositories.base import BaseRepository


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
        status: str,
        limit: int = 100,
    ) -> List[WorkflowRun]:
        session = self._session(db)
        return (
            session.query(WorkflowRun)
            .filter(
                WorkflowRun.business_id == business_id,
                WorkflowRun.status == status,
            )
            .order_by(WorkflowRun.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_pending(self, db: Session | None, business_id: UUID) -> List[WorkflowRun]:
        return self.get_by_status(db, business_id, "pending")

    def get_failed(self, db: Session | None, business_id: UUID, limit: int = 100) -> List[WorkflowRun]:
        return self.get_by_status(db, business_id, "failed", limit)

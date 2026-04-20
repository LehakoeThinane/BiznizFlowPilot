"""Tests for Phase 4 workflow dispatch architecture."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.enums import EventStatus, EventType, WorkflowRunStatus
from app.models import WorkflowDefinition, WorkflowRun
from app.repositories.event import EventRepository
from app.services.event import EventService
from app.workflow_engine import InMemoryDefinitionProvider, WorkflowDispatcher
from app.workers.event_dispatch import process_next_event_for_business


class TestWorkflowDispatcher:
    """Unit tests for dispatcher behavior."""

    def test_dispatch_no_matches(self, test_db: Session, owner_user):
        event_service = EventService(test_db)
        event = event_service.create_event(
            business_id=owner_user.business_id,
            event_type=EventType.LEAD_CREATED,
            entity_type="lead",
            entity_id=uuid4(),
        )
        test_db.commit()

        provider = InMemoryDefinitionProvider([])
        dispatcher = WorkflowDispatcher(db=test_db, definition_provider=provider)

        runs = dispatcher.dispatch(event)

        assert runs == []

    def test_dispatch_single_match_creates_run(self, test_db: Session, owner_user):
        event_service = EventService(test_db)
        event = event_service.create_event(
            business_id=owner_user.business_id,
            event_type=EventType.LEAD_CREATED,
            entity_type="lead",
            entity_id=uuid4(),
        )

        definition = WorkflowDefinition(
            id=uuid4(),
            business_id=owner_user.business_id,
            event_type=EventType.LEAD_CREATED,
            is_active=True,
            name="Lead Created Definition",
        )
        test_db.add(definition)
        test_db.commit()

        provider = InMemoryDefinitionProvider([definition])
        dispatcher = WorkflowDispatcher(db=test_db, definition_provider=provider)

        runs = dispatcher.dispatch(event)
        test_db.commit()

        assert len(runs) == 1
        assert runs[0].event_id == event.id
        assert runs[0].workflow_definition_id == definition.id
        assert runs[0].status == WorkflowRunStatus.QUEUED
        assert runs[0].definition_snapshot["event_type"] == EventType.LEAD_CREATED.value

    def test_dispatch_multiple_matches_creates_multiple_runs(self, test_db: Session, owner_user):
        event_service = EventService(test_db)
        event = event_service.create_event(
            business_id=owner_user.business_id,
            event_type=EventType.TASK_CREATED,
            entity_type="task",
            entity_id=uuid4(),
        )

        definitions = [
            WorkflowDefinition(
                id=uuid4(),
                business_id=owner_user.business_id,
                event_type=EventType.TASK_CREATED,
                is_active=True,
                name="Definition 1",
            ),
            WorkflowDefinition(
                id=uuid4(),
                business_id=owner_user.business_id,
                event_type=EventType.TASK_CREATED,
                is_active=True,
                name="Definition 2",
            ),
        ]
        test_db.add_all(definitions)
        test_db.commit()

        provider = InMemoryDefinitionProvider(definitions)
        dispatcher = WorkflowDispatcher(db=test_db, definition_provider=provider)

        runs = dispatcher.dispatch(event)
        test_db.commit()

        assert len(runs) == 2
        assert {run.workflow_definition_id for run in runs} == {definition.id for definition in definitions}

    def test_dispatch_skips_inactive_definitions(self, test_db: Session, owner_user):
        event_service = EventService(test_db)
        event = event_service.create_event(
            business_id=owner_user.business_id,
            event_type=EventType.LEAD_STATUS_CHANGED,
            entity_type="lead",
            entity_id=uuid4(),
        )

        active = WorkflowDefinition(
            id=uuid4(),
            business_id=owner_user.business_id,
            event_type=EventType.LEAD_STATUS_CHANGED,
            is_active=True,
            name="Active Definition",
        )
        inactive = WorkflowDefinition(
            id=uuid4(),
            business_id=owner_user.business_id,
            event_type=EventType.LEAD_STATUS_CHANGED,
            is_active=False,
            name="Inactive Definition",
        )
        test_db.add_all([active, inactive])
        test_db.commit()

        provider = InMemoryDefinitionProvider([active, inactive])
        dispatcher = WorkflowDispatcher(db=test_db, definition_provider=provider)

        runs = dispatcher.dispatch(event)
        test_db.commit()

        assert len(runs) == 1
        assert runs[0].workflow_definition_id == active.id

    def test_dispatch_skips_malformed_definitions(self, test_db: Session, owner_user):
        event_service = EventService(test_db)
        event = event_service.create_event(
            business_id=owner_user.business_id,
            event_type=EventType.TASK_ASSIGNED,
            entity_type="task",
            entity_id=uuid4(),
        )

        good_definition = WorkflowDefinition(
            id=uuid4(),
            business_id=owner_user.business_id,
            event_type=EventType.TASK_ASSIGNED,
            is_active=True,
            name="Good Definition",
        )
        malformed_definition = SimpleNamespace(id=uuid4(), business_id=owner_user.business_id)

        test_db.add(good_definition)
        test_db.commit()

        provider = InMemoryDefinitionProvider([good_definition, malformed_definition])
        dispatcher = WorkflowDispatcher(db=test_db, definition_provider=provider)

        runs = dispatcher.dispatch(event)
        test_db.commit()

        assert len(runs) == 1
        assert runs[0].workflow_definition_id == good_definition.id

    def test_dispatch_duplicate_blocked_by_unique_index(self, test_db: Session, owner_user):
        event_service = EventService(test_db)
        event = event_service.create_event(
            business_id=owner_user.business_id,
            event_type=EventType.TASK_COMPLETED,
            entity_type="task",
            entity_id=uuid4(),
        )

        definition = WorkflowDefinition(
            id=uuid4(),
            business_id=owner_user.business_id,
            event_type=EventType.TASK_COMPLETED,
            is_active=True,
            name="Completion Definition",
        )
        test_db.add(definition)
        test_db.commit()

        provider = InMemoryDefinitionProvider([definition])
        dispatcher = WorkflowDispatcher(db=test_db, definition_provider=provider)

        first_runs = dispatcher.dispatch(event)
        test_db.commit()

        second_runs = dispatcher.dispatch(event)
        test_db.commit()

        persisted_runs = (
            test_db.query(WorkflowRun)
            .filter(
                WorkflowRun.business_id == owner_user.business_id,
                WorkflowRun.event_id == event.id,
                WorkflowRun.workflow_definition_id == definition.id,
            )
            .all()
        )

        assert len(first_runs) == 1
        assert second_runs == []
        assert len(persisted_runs) == 1


class TestWorkerDispatchLoop:
    """Integration tests for claim -> dispatch -> commit loop."""

    def test_claim_dispatch_commit_with_partial_failure(self, test_db: Session, owner_user):
        event_service = EventService(test_db)
        event = event_service.create_event(
            business_id=owner_user.business_id,
            event_type=EventType.LEAD_CREATED,
            entity_type="lead",
            entity_id=uuid4(),
            actor_id=owner_user.user_id,
        )

        valid_definition = WorkflowDefinition(
            id=uuid4(),
            business_id=owner_user.business_id,
            event_type=EventType.LEAD_CREATED,
            is_active=True,
            name="Valid Definition",
        )
        malformed_definition = SimpleNamespace(id=uuid4(), business_id=owner_user.business_id)

        test_db.add(valid_definition)
        test_db.commit()

        provider = InMemoryDefinitionProvider([valid_definition, malformed_definition])
        result = process_next_event_for_business(
            db=test_db,
            business_id=owner_user.business_id,
            worker_id="worker-integration",
            provider=provider,
        )

        refreshed_event = EventRepository(test_db).get(owner_user.business_id, event.id)
        runs = (
            test_db.query(WorkflowRun)
            .filter(
                WorkflowRun.business_id == owner_user.business_id,
                WorkflowRun.event_id == event.id,
            )
            .all()
        )

        assert result["claimed"] is True
        assert result["runs_created"] == 1
        assert result["event_status"] == EventStatus.DISPATCHED.value
        assert refreshed_event.status == EventStatus.DISPATCHED
        assert len(runs) == 1
        assert runs[0].workflow_definition_id == valid_definition.id
        assert runs[0].status == WorkflowRunStatus.QUEUED

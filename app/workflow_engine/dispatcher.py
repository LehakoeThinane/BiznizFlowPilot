"""Workflow dispatcher for Phase 4 event-to-run materialization."""

from __future__ import annotations

import logging
from typing import List

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Event, WorkflowRun
from app.repositories.workflow import WorkflowRunRepository
from app.workflow_engine.definition_provider import DefinitionProvider


logger = logging.getLogger(__name__)


class WorkflowDispatcher:
    """Dispatches a claimed event into queued workflow runs.

    Contract:
    - Receives a claimed event
    - Resolves matching definitions from provider
    - Filters inactive definitions
    - Creates one WorkflowRun per valid definition
    - Skips malformed definitions without failing whole dispatch
    - Does not claim events, execute actions, or commit
    """

    def __init__(
        self,
        db: Session,
        definition_provider: DefinitionProvider,
        run_repository: WorkflowRunRepository | None = None,
    ):
        self.db = db
        self.definition_provider = definition_provider
        self.run_repository = run_repository or WorkflowRunRepository(db)

    def dispatch(self, event: Event) -> list[WorkflowRun]:
        """Create queued workflow runs for definitions matching the event."""
        definitions = self.definition_provider.get_definitions_for_event(
            business_id=event.business_id,
            event_type=event.event_type,
        )

        created_runs: List[WorkflowRun] = []

        for definition in definitions:
            try:
                if not definition.is_active:
                    continue
                # TODO Phase 5: evaluate definition.conditions against event.data here.

                if definition.id is None:
                    raise ValueError("Workflow definition is missing an ID")

                definition_snapshot = definition.to_snapshot()

                with self.db.begin_nested():
                    run = self.run_repository.create_from_definition(
                        db=self.db,
                        business_id=event.business_id,
                        event_id=event.id,
                        workflow_definition_id=definition.id,
                        actor_id=event.actor_id,
                        definition_snapshot=definition_snapshot,
                        workflow_id=getattr(definition, "workflow_id", None),
                    )
                created_runs.append(run)
            except IntegrityError:
                logger.info(
                    "Skipping duplicate workflow run for event=%s definition=%s",
                    event.id,
                    getattr(definition, "id", None),
                )
            except Exception:
                logger.warning(
                    "Skipping malformed or invalid workflow definition for event=%s definition=%s",
                    event.id,
                    getattr(definition, "id", None),
                    exc_info=True,
                )

        return created_runs

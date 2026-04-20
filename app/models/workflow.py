"""
Workflow models for automation engine.

Workflows define automation rules:
- Trigger on specific event types
- Execute configured actions in sequence
- Track execution results and status
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.core.enums import EventType, WorkflowRunStatus
from app.models.base import BaseModel


class Workflow(BaseModel):
    """Workflow automation rules.

    Attributes:
        business_id: Multi-tenant identifier
        name: Human-readable workflow name
        description: Detailed explanation of workflow purpose
        trigger_event_type: Event type that triggers this workflow (e.g., 'lead_created')
        enabled: Whether workflow is active
        order: Execution order when multiple workflows match same event
    """

    __tablename__ = "workflows"

    business_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    trigger_event_type = Column(String(100), nullable=False, index=True)
    enabled = Column(Boolean, default=True, nullable=False)
    order = Column(Integer, default=0, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class WorkflowDefinition(BaseModel):
    """Workflow definition used by the dispatcher.

    This model is intentionally minimal in Phase 4 and stores enough metadata
    for matching by event type and recording immutable snapshots on run creation.
    """

    __tablename__ = "workflow_definitions"

    business_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(
        SAEnum(EventType, name="event_type_enum"),
        nullable=False,
        index=True,
    )
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    name = Column(String(255), nullable=False, default="Workflow Definition")
    conditions = Column(JSON, nullable=False, default=dict)
    config = Column(JSON, nullable=False, default=dict)

    # Legacy bridge while Workflow table is still used by CRUD endpoints.
    # TODO: Remove in Phase 6 once Workflow CRUD endpoints are migrated to
    # WorkflowDefinition.
    workflow_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    def to_snapshot(self) -> dict[str, object]:
        """Serialize definition data for immutable run snapshots."""
        return {
            "id": str(self.id) if self.id else None,
            "business_id": str(self.business_id),
            "event_type": self.event_type.value if isinstance(self.event_type, EventType) else str(self.event_type),
            "is_active": bool(self.is_active),
            "name": self.name,
            "conditions": self.conditions or {},
            "config": self.config or {},
            "workflow_id": str(self.workflow_id) if self.workflow_id else None,
        }


class WorkflowAction(BaseModel):
    """Individual actions within a workflow.

    Actions execute in order and can:
    - Send notifications
    - Update entity state
    - Trigger external webhooks
    - Create follow-up tasks

    Attributes:
        workflow_id: Parent workflow
        action_type: Type of action (e.g., 'send_email', 'create_task', 'update_lead')
        parameters: JSON config for action execution
        order: Execution sequence within workflow
    """

    __tablename__ = "workflow_actions"

    workflow_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action_type = Column(String(100), nullable=False)
    parameters = Column(JSON, default=dict, nullable=False)
    order = Column(Integer, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class WorkflowRun(BaseModel):
    """Execution record created by dispatcher when an event matches definitions."""

    __tablename__ = "workflow_runs"
    __table_args__ = (
        Index(
            "ux_workflow_runs_event_definition",
            "event_id",
            "workflow_definition_id",
            unique=True,
        ),
    )

    # Legacy bridge for existing workflow CRUD APIs.
    workflow_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    workflow_definition_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("workflow_definitions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    business_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status = Column(
        SAEnum(WorkflowRunStatus, name="workflow_run_status"),
        nullable=False,
        default=WorkflowRunStatus.QUEUED,
        server_default=WorkflowRunStatus.QUEUED.value,
        index=True,
    )
    definition_snapshot = Column(JSON, nullable=False, default=dict)
    error_message = Column(Text, nullable=True)
    results = Column(JSON, default=dict, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    @property
    def triggered_by_event_id(self) -> UUID | None:
        """Backward-compatible alias for legacy schema/API consumers."""
        return self.event_id

    @triggered_by_event_id.setter
    def triggered_by_event_id(self, value: UUID | None) -> None:
        self.event_id = value

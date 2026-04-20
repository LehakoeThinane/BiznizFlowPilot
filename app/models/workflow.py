"""
Workflow models for automation engine.

Workflows define automation rules:
- Trigger on specific event types
- Execute configured actions in sequence
- Track execution results and status
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

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
    """Execution record of a workflow triggered by an event.
    
    Tracks when workflow runs, status, and results for monitoring and debugging.
    
    Attributes:
        workflow_id: Which workflow was executed
        business_id: Multi-tenant identifier
        triggered_by_event_id: Event that triggered this run
        actor_id: User who triggered (via event)
        status: Current status (pending, running, success, failed)
        error_message: Error details if status is failed
        results: JSON results from action executions
    """

    __tablename__ = "workflow_runs"

    workflow_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    business_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    triggered_by_event_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status = Column(String(20), default="pending", nullable=False)  # pending, running, success, failed
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

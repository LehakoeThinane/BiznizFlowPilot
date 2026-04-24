"""Core enums shared across models and schemas."""

from enum import Enum


class EventStatus(str, Enum):
    """Lifecycle state for workflow event processing."""

    PENDING = "pending"
    CLAIMED = "claimed"
    DISPATCHED = "dispatched"
    FAILED = "failed"


class WorkflowRunStatus(str, Enum):
    """Lifecycle state for workflow runs after event dispatch."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class WorkflowActionStatus(str, Enum):
    """Execution state for materialized workflow actions."""

    PENDING = "pending"
    RUNNING = "running"
    RETRY_SCHEDULED = "retry_scheduled"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ActionFailureType(str, Enum):
    """Failure categories aligned to retry behavior in the executor."""

    RETRYABLE = "retryable"
    TERMINAL = "terminal"
    SKIPPABLE = "skippable"


class EventType(str, Enum):
    """Canonical event types emitted by business actions."""

    LEAD_CREATED = "lead_created"
    LEAD_STATUS_CHANGED = "lead_status_changed"
    LEAD_IDLE = "lead_idle"
    TASK_CREATED = "task_created"
    TASK_ASSIGNED = "task_assigned"
    TASK_COMPLETED = "task_completed"
    TASK_OVERDUE = "task_overdue"
    WORKFLOW_TRIGGERED = "workflow_triggered"
    CUSTOM = "custom"

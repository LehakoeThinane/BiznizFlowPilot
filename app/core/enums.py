"""Core enums shared across models and schemas."""

from enum import Enum


class EventStatus(str, Enum):
    """Lifecycle state for workflow event processing."""

    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


class EventType(str, Enum):
    """Canonical event types emitted by business actions."""

    LEAD_CREATED = "lead_created"
    LEAD_STATUS_CHANGED = "lead_status_changed"
    TASK_CREATED = "task_created"
    TASK_ASSIGNED = "task_assigned"
    TASK_COMPLETED = "task_completed"
    WORKFLOW_TRIGGERED = "workflow_triggered"
    CUSTOM = "custom"

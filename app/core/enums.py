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

    # --- CRM: Leads ---
    LEAD_CREATED = "lead_created"
    LEAD_UPDATED = "lead_updated"
    LEAD_STATUS_CHANGED = "lead_status_changed"
    LEAD_ASSIGNED = "lead_assigned"
    LEAD_DELETED = "lead_deleted"
    LEAD_IDLE = "lead_idle"

    # --- CRM: Tasks ---
    TASK_CREATED = "task_created"
    TASK_UPDATED = "task_updated"
    TASK_ASSIGNED = "task_assigned"
    TASK_COMPLETED = "task_completed"
    TASK_DELETED = "task_deleted"
    TASK_OVERDUE = "task_overdue"

    # --- CRM: Customers ---
    CUSTOMER_CREATED = "customer_created"
    CUSTOMER_UPDATED = "customer_updated"
    CUSTOMER_DELETED = "customer_deleted"

    # --- ERP: Products ---
    PRODUCT_CREATED = "product_created"
    PRODUCT_UPDATED = "product_updated"
    PRODUCT_DELETED = "product_deleted"

    # --- ERP: Suppliers ---
    SUPPLIER_CREATED = "supplier_created"
    SUPPLIER_UPDATED = "supplier_updated"
    SUPPLIER_DELETED = "supplier_deleted"

    # --- ERP: Sales Orders ---
    ORDER_CREATED = "order_created"
    ORDER_CONFIRMED = "order_confirmed"
    ORDER_SHIPPED = "order_shipped"
    ORDER_DELIVERED = "order_delivered"
    ORDER_CANCELLED = "order_cancelled"

    # --- ERP: Inventory ---
    STOCK_LOW = "stock_low"
    STOCK_ADJUSTED = "stock_adjusted"
    STOCK_TRANSFERRED = "stock_transferred"

    # --- ERP: Purchasing ---
    PURCHASE_ORDER_CREATED = "purchase_order_created"
    PURCHASE_ORDER_SENT = "purchase_order_sent"
    PURCHASE_ORDER_RECEIVED = "purchase_order_received"

    # --- System ---
    WORKFLOW_TRIGGERED = "workflow_triggered"
    CUSTOM = "custom"

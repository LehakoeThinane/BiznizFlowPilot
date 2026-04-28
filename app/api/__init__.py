"""API package."""

from app.api import (
    auth,
    customers,
    events,
    inventory,
    leads,
    metrics,
    products,
    purchase_orders,
    sales_orders,
    suppliers,
    tasks,
    users,
    workflow_definitions,
    workflows,
)

__all__ = [
    "auth",
    "customers",
    "events",
    "inventory",
    "leads",
    "metrics",
    "products",
    "purchase_orders",
    "sales_orders",
    "suppliers",
    "tasks",
    "users",
    "workflow_definitions",
    "workflows",
]

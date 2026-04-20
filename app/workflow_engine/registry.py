"""Action handler registry wiring."""

from __future__ import annotations

from app.workflow_engine.action_handlers import ActionHandlerRegistry
from app.workflow_engine.handlers import LogActionHandler


def build_default_action_registry() -> ActionHandlerRegistry:
    """Create registry with built-in handlers for Phase 5."""
    registry = ActionHandlerRegistry()
    registry.register(LogActionHandler())
    return registry

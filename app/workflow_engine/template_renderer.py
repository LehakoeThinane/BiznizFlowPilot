"""Shared template rendering utilities for workflow actions."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sqlalchemy.orm import Session

from app.workflow_engine.context import render_template_with_context


def render_template_string(db: Session, context: dict[str, Any], template: str) -> str:
    """Render one template string using workflow context.

    Contract:
    - Missing template values raise MissingTemplateValueError from the context
      renderer (strict mode).
    - This helper never substitutes missing placeholders silently.
    - Rendering errors are propagated to callers for explicit classification.
    """
    return render_template_with_context(db, context, template)


def render_template_value(db: Session, context: dict[str, Any], value: Any) -> Any:
    """Render template placeholders inside a nested value recursively."""
    if isinstance(value, str):
        return render_template_string(db, context, value)
    if isinstance(value, list):
        return [render_template_value(db, context, item) for item in value]
    if isinstance(value, Mapping):
        return {
            str(key): render_template_value(db, context, nested_value)
            for key, nested_value in value.items()
        }
    return value

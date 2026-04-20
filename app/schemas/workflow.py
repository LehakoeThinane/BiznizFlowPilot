"""
Workflow request and response schemas.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class WorkflowActionCreate(BaseModel):
    """Create workflow action request."""

    action_type: str = Field(..., min_length=1, max_length=100)
    parameters: Dict[str, Any] = Field(default_factory=dict)
    order: int


class WorkflowActionResponse(WorkflowActionCreate):
    """Workflow action response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workflow_id: UUID
    created_at: datetime
    updated_at: datetime

class WorkflowCreate(BaseModel):
    """Create workflow request."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    trigger_event_type: str = Field(..., min_length=1, max_length=100)
    enabled: bool = True
    order: int = 0
    actions: List[WorkflowActionCreate] = Field(default_factory=list)

    @field_validator("actions")
    @classmethod
    def validate_actions(cls, v: List[WorkflowActionCreate]) -> List[WorkflowActionCreate]:
        """Ensure actions are ordered correctly."""
        if v:
            sorted_actions = sorted(v, key=lambda a: a.order)
            for i, action in enumerate(sorted_actions):
                if action.order != i:
                    raise ValueError("Actions must have sequential order starting from 0")
        return v


class WorkflowUpdate(BaseModel):
    """Update workflow request."""

    name: Optional[str] = None
    description: Optional[str] = None
    trigger_event_type: Optional[str] = None
    enabled: Optional[bool] = None
    order: Optional[int] = None


class WorkflowResponse(BaseModel):
    """Workflow response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    description: Optional[str]
    trigger_event_type: str
    enabled: bool
    order: int
    actions: List[WorkflowActionResponse]
    created_at: datetime
    updated_at: datetime

class WorkflowListResponse(BaseModel):
    """Workflow list response."""

    total: int
    workflows: List[WorkflowResponse]


class WorkflowRunResponse(BaseModel):
    """Workflow run response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workflow_id: UUID
    business_id: UUID
    triggered_by_event_id: Optional[UUID]
    actor_id: Optional[UUID]
    status: str  # pending, running, success, failed
    error_message: Optional[str]
    results: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

class WorkflowRunListResponse(BaseModel):
    """Workflow run list response."""

    total: int
    runs: List[WorkflowRunResponse]

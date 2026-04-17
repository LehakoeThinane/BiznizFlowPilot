"""Pydantic schemas package."""

from app.schemas.auth import CurrentUser, LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.schemas.customer import CustomerCreate, CustomerListResponse, CustomerResponse, CustomerUpdate
from app.schemas.event import EventCreate, EventListResponse, EventResponse, EventUpdate
from app.schemas.lead import LeadCreate, LeadListResponse, LeadResponse, LeadUpdate
from app.schemas.task import TaskCreate, TaskListResponse, TaskResponse, TaskUpdate
from app.schemas.user import UserCreate, UserListResponse, UserResponse, UserUpdate

__all__ = [
    # Auth
    "RegisterRequest",
    "LoginRequest",
    "TokenResponse",
    "CurrentUser",
    "UserResponse",
    # Customer
    "CustomerCreate",
    "CustomerUpdate",
    "CustomerResponse",
    "CustomerListResponse",
    # Event
    "EventCreate",
    "EventUpdate",
    "EventResponse",
    "EventListResponse",
    # Lead
    "LeadCreate",
    "LeadUpdate",
    "LeadResponse",
    "LeadListResponse",
    # Task
    "TaskCreate",
    "TaskUpdate",
    "TaskResponse",
    "TaskListResponse",
    # User
    "UserCreate",
    "UserUpdate",
    "UserListResponse",
]

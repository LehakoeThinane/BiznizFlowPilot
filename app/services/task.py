"""Task service - business logic."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.task import Task
from app.repositories.task import TaskRepository
from app.schemas.task import TaskCreate, TaskUpdate
from app.schemas.auth import CurrentUser


class TaskService:
    """Task service with RBAC and task management.
    
    🧨 RBAC: Owner/Manager can create/assign. Staff can view own and complete.
    """

    def __init__(self, db: Session):
        """Initialize service."""
        self.db = db
        self.repo = TaskRepository(db)

    def create(self, business_id: UUID, current_user: CurrentUser, data: TaskCreate) -> Task:
        """Create task.
        
        🧨 RBAC: Only owner/manager can create.
        """
        if current_user.role not in ["owner", "manager"]:
            raise ValueError("Permission denied: Only owner/manager can create tasks")

        return self.repo.create(business_id=business_id, **data.dict())

    def get(self, business_id: UUID, current_user: CurrentUser, task_id: UUID) -> Task | None:
        """Get task by ID.
        
        🧨 RBAC: All roles can view tasks in their business, but staff only see assigned to them.
        """
        task = self.repo.get(business_id=business_id, entity_id=task_id)
        if not task:
            return None

        # Staff can only view tasks assigned to them
        if current_user.role == "staff" and task.assigned_to != current_user.id:
            raise ValueError("Permission denied: Staff can only view their own tasks")

        return task

    def list(self, business_id: UUID, current_user: CurrentUser, skip: int = 0, limit: int = 100) -> tuple[list[Task], int]:
        """List tasks.
        
        🧨 RBAC: Owner/Manager see all. Staff see assigned to them.
        """
        if current_user.role in ["owner", "manager"]:
            tasks = self.repo.list(business_id=business_id, skip=skip, limit=limit)
            total = self.repo.count(business_id=business_id)
        else:
            # Staff only sees tasks assigned to them
            tasks = self.repo.get_assigned_to(business_id=business_id, assigned_to=current_user.id, skip=skip, limit=limit)
            total = self.repo.count_assigned_to(business_id=business_id, assigned_to=current_user.id)

        return tasks, total

    def list_by_status(self, business_id: UUID, current_user: CurrentUser, status: str, skip: int = 0, limit: int = 100) -> tuple[list[Task], int]:
        """List tasks by status.
        
        🧨 RBAC: Owner/Manager see all. Staff see assigned to them.
        """
        if current_user.role in ["owner", "manager"]:
            tasks = self.repo.get_by_status(business_id=business_id, status=status, skip=skip, limit=limit)
            total = self.repo.count_by_status(business_id=business_id, status=status)
        else:
            # Staff only sees own tasks
            all_tasks = self.repo.get_assigned_to(business_id=business_id, assigned_to=current_user.id)
            tasks = [t for t in all_tasks if t.status == status][skip:skip+limit]
            total = len([t for t in all_tasks if t.status == status])

        return tasks, total

    def list_overdue(self, business_id: UUID, current_user: CurrentUser, skip: int = 0, limit: int = 100) -> tuple[list[Task], int]:
        """List overdue tasks.
        
        🧨 RBAC: Owner/Manager see all. Staff see assigned to them.
        """
        if current_user.role in ["owner", "manager"]:
            tasks = self.repo.get_overdue(business_id=business_id, skip=skip, limit=limit)
            total = self.repo.count_overdue(business_id=business_id)
        else:
            # Staff only sees own overdue tasks
            all_tasks = self.repo.get_assigned_to(business_id=business_id, assigned_to=current_user.id)
            overdue = [t for t in all_tasks if t.due_date and t.due_date < datetime.now(tz=None) and t.status != "completed"]
            tasks = overdue[skip:skip+limit]
            total = len(overdue)

        return tasks, total

    def update(self, business_id: UUID, current_user: CurrentUser, task_id: UUID, data: TaskUpdate) -> Task | None:
        """Update task.
        
        🧨 RBAC: Owner/Manager can edit all. Staff can only update their own.
        """
        task = self.repo.get(business_id=business_id, entity_id=task_id)
        if not task:
            return None

        # Staff can only update their own tasks
        if current_user.role == "staff" and task.assigned_to != current_user.id:
            raise ValueError("Permission denied: Staff can only update their own tasks")

        update_data = data.dict(exclude_unset=True)

        # Mark completed_at when status changes to completed
        if data.status == "completed":
            update_data["completed_at"] = datetime.now(tz=None)

        return self.repo.update(business_id=business_id, entity_id=task_id, **update_data)

    def assign(self, business_id: UUID, current_user: CurrentUser, task_id: UUID, assigned_to: UUID) -> Task | None:
        """Assign task to user.
        
        🧨 RBAC: Only owner/manager can assign.
        """
        if current_user.role not in ["owner", "manager"]:
            raise ValueError("Permission denied: Only owner/manager can assign tasks")

        task = self.repo.get(business_id=business_id, entity_id=task_id)
        if not task:
            return None

        return self.repo.update(business_id=business_id, entity_id=task_id, assigned_to=assigned_to)

    def delete(self, business_id: UUID, current_user: CurrentUser, task_id: UUID) -> bool:
        """Delete task.
        
        🧨 RBAC: Only owner can permanently delete.
        """
        if current_user.role != "owner":
            raise ValueError("Permission denied: Only owner can delete tasks")

        task = self.repo.get(business_id=business_id, entity_id=task_id)
        if not task:
            return False

        self.repo.delete(business_id=business_id, entity_id=task_id)
        return True

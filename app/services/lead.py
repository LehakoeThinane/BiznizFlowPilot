"""Lead service - business logic."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.lead import Lead
from app.repositories.lead import LeadRepository
from app.schemas.lead import LeadCreate, LeadUpdate
from app.schemas.auth import CurrentUser


class LeadService:
    """Lead service with RBAC and pipeline state management.
    
    🧨 RBAC: Owner/Manager can create/assign. Staff can view own and update status.
    State transitions: new → contacted → qualified → (won|lost)
    """

    # Valid state transitions
    VALID_TRANSITIONS = {
        "new": ["contacted", "lost"],
        "contacted": ["qualified", "lost"],
        "qualified": ["won", "lost"],
        "won": [],
        "lost": [],
    }

    def __init__(self, db: Session):
        """Initialize service."""
        self.db = db
        self.repo = LeadRepository(db)

    def create(self, business_id: UUID, current_user: CurrentUser, data: LeadCreate) -> Lead:
        """Create lead.
        
        🧨 RBAC: Only owner/manager can create.
        """
        if current_user.role not in ["owner", "manager"]:
            raise ValueError("Permission denied: Only owner/manager can create leads")

        return self.repo.create(business_id=business_id, **data.model_dump())

    def get(self, business_id: UUID, current_user: CurrentUser, lead_id: UUID) -> Lead | None:
        """Get lead by ID.
        
        🧨 RBAC: All roles can view leads in their business.
        """
        return self.repo.get(business_id=business_id, entity_id=lead_id)

    def list(self, business_id: UUID, current_user: CurrentUser, skip: int = 0, limit: int = 100) -> tuple[list[Lead], int]:
        """List leads.
        
        🧨 RBAC: Owner/Manager see all. Staff see assigned to them.
        """
        if current_user.role in ["owner", "manager"]:
            leads = self.repo.list(business_id=business_id, skip=skip, limit=limit)
            total = self.repo.count(business_id=business_id)
        else:
            # Staff only sees leads assigned to them
            leads = self.repo.get_assigned_to(business_id=business_id, assigned_to=current_user.id, skip=skip, limit=limit)
            total = self.repo.count_assigned_to(business_id=business_id, assigned_to=current_user.id)

        return leads, total

    def list_by_status(self, business_id: UUID, current_user: CurrentUser, status: str, skip: int = 0, limit: int = 100) -> tuple[list[Lead], int]:
        """List leads by status.
        
        🧨 RBAC: Owner/Manager see all. Staff see assigned to them.
        """
        if current_user.role in ["owner", "manager"]:
            leads = self.repo.get_by_status(business_id=business_id, status=status, skip=skip, limit=limit)
            total = self.repo.count_by_status(business_id=business_id, status=status)
        else:
            # Staff only sees own leads
            all_leads = self.repo.get_assigned_to(business_id=business_id, assigned_to=current_user.id)
            leads = [l for l in all_leads if l.status == status][skip:skip+limit]
            total = len([l for l in all_leads if l.status == status])

        return leads, total

    def update(self, business_id: UUID, current_user: CurrentUser, lead_id: UUID, data: LeadUpdate) -> Lead | None:
        """Update lead.
        
        🧨 RBAC: Owner/Manager can edit all. Staff can only update status of own leads.
        """
        lead = self.repo.get(business_id=business_id, entity_id=lead_id)
        if not lead:
            return None

        # Staff can only update their own leads
        if current_user.role == "staff" and lead.assigned_to != current_user.id:
            raise ValueError("Permission denied: Staff can only update their own leads")

        # Validate state transition if status is being updated
        if data.status is not None and data.status != lead.status:
            if not self._is_valid_transition(lead.status, data.status):
                raise ValueError(f"Invalid state transition: {lead.status} → {data.status}")

        update_data = data.model_dump(exclude_unset=True)
        return self.repo.update(business_id=business_id, entity_id=lead_id, **update_data)

    def assign(self, business_id: UUID, current_user: CurrentUser, lead_id: UUID, assigned_to: UUID) -> Lead | None:
        """Assign lead to user.
        
        🧨 RBAC: Only owner/manager can assign.
        """
        if current_user.role not in ["owner", "manager"]:
            raise ValueError("Permission denied: Only owner/manager can assign leads")

        lead = self.repo.get(business_id=business_id, entity_id=lead_id)
        if not lead:
            return None

        return self.repo.update(business_id=business_id, entity_id=lead_id, assigned_to=assigned_to)

    def delete(self, business_id: UUID, current_user: CurrentUser, lead_id: UUID) -> bool:
        """Delete lead.
        
        🧨 RBAC: Only owner can permanently delete.
        """
        if current_user.role != "owner":
            raise ValueError("Permission denied: Only owner can delete leads")

        lead = self.repo.get(business_id=business_id, entity_id=lead_id)
        if not lead:
            return False

        self.repo.delete(business_id=business_id, entity_id=lead_id)
        return True

    @staticmethod
    def _is_valid_transition(current_status: str, new_status: str) -> bool:
        """Check if state transition is valid."""
        return new_status in LeadService.VALID_TRANSITIONS.get(current_status, [])

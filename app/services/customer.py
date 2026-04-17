"""Customer service - business logic."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.repositories.customer import CustomerRepository
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.schemas.auth import CurrentUser


class CustomerService:
    """Customer service with RBAC.
    
    🧨 RBAC: Owner/Manager can create/edit/delete. Staff can view their assigned customers.
    """

    def __init__(self, db: Session):
        """Initialize service."""
        self.db = db
        self.repo = CustomerRepository(db)

    def create(self, business_id: UUID, current_user: CurrentUser, data: CustomerCreate) -> Customer:
        """Create customer.
        
        🧨 RBAC: Only owner/manager can create.
        """
        if current_user.role not in ["owner", "manager"]:
            raise ValueError("Permission denied: Only owner/manager can create customers")

        return self.repo.create(business_id=business_id, **data.dict())

    def get(self, business_id: UUID, current_user: CurrentUser, customer_id: UUID) -> Customer | None:
        """Get customer by ID.
        
        🧨 All roles can view customers in their business.
        """
        return self.repo.get(business_id=business_id, entity_id=customer_id)

    def list(self, business_id: UUID, current_user: CurrentUser, skip: int = 0, limit: int = 100) -> tuple[list[Customer], int]:
        """List customers.
        
        🧨 All roles can view customers in their business.
        """
        customers = self.repo.list(business_id=business_id, skip=skip, limit=limit)
        total = self.repo.count(business_id=business_id)
        return customers, total

    def search(self, business_id: UUID, current_user: CurrentUser, name_part: str, skip: int = 0, limit: int = 100) -> tuple[list[Customer], int]:
        """Search customers by name.
        
        🧨 All roles can search customers in their business.
        """
        customers = self.repo.list_by_name(business_id=business_id, name_part=name_part, skip=skip, limit=limit)
        total = self.repo.count_by_name(business_id=business_id, name_part=name_part)
        return customers, total

    def update(self, business_id: UUID, current_user: CurrentUser, customer_id: UUID, data: CustomerUpdate) -> Customer | None:
        """Update customer.
        
        🧨 RBAC: Only owner/manager can edit.
        """
        if current_user.role not in ["owner", "manager"]:
            raise ValueError("Permission denied: Only owner/manager can edit customers")

        # Verify customer exists in business before updating
        customer = self.repo.get(business_id=business_id, entity_id=customer_id)
        if not customer:
            return None

        update_data = data.dict(exclude_unset=True)
        return self.repo.update(business_id=business_id, entity_id=customer_id, **update_data)

    def delete(self, business_id: UUID, current_user: CurrentUser, customer_id: UUID) -> bool:
        """Delete customer.
        
        🧨 RBAC: Only owner can permanently delete.
        """
        if current_user.role != "owner":
            raise ValueError("Permission denied: Only owner can delete customers")

        # Verify customer exists in business before deleting
        customer = self.repo.get(business_id=business_id, entity_id=customer_id)
        if not customer:
            return False

        self.repo.delete(business_id=business_id, entity_id=customer_id)
        return True

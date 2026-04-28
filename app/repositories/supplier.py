"""Supplier repository - data access layer."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.supplier import Supplier
from app.repositories.base import BaseRepository


class SupplierRepository(BaseRepository[Supplier]):
    """Supplier repository with business_id filtering."""

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(db, Supplier)

"""Inventory repositories - data access layer."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.models.inventory import InventoryLocation, StockLevel
from app.repositories.base import BaseRepository


class InventoryLocationRepository(BaseRepository[InventoryLocation]):
    """InventoryLocation repository with business_id filtering."""

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(db, InventoryLocation)


class StockLevelRepository(BaseRepository[StockLevel]):
    """StockLevel repository with business_id filtering."""

    def __init__(self, db: Session):
        """Initialize repository."""
        super().__init__(db, StockLevel)

    def get_by_product_and_location(self, product_id: UUID, location_id: UUID) -> StockLevel | None:
        """Get stock level for a product at a specific location."""
        return self.db.query(StockLevel).filter(
            StockLevel.product_id == product_id,
            StockLevel.location_id == location_id,
        ).first()

    def get_low_stock(self, limit: int = 100) -> list[StockLevel]:
        """Get low stock items across all locations (needs manual business filter in service)."""
        return self.db.query(StockLevel).filter(
            StockLevel.available < StockLevel.reorder_point
        ).limit(limit).all()

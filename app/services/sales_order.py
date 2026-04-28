"""Sales order service - business logic with auto-event emission."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.enums import EventType
from app.models.sales_order import SalesOrder, OrderLineItem
from app.repositories.sales_order import SalesOrderRepository
from app.schemas.sales_order import OrderCreate, OrderUpdate
from app.schemas.auth import CurrentUser

logger = logging.getLogger(__name__)


class SalesOrderService:
    """Sales order service with RBAC and state machine."""

    def __init__(self, db: Session, event_service=None):
        self.db = db
        self.repo = SalesOrderRepository(db)
        self._event_service = event_service

    def _emit_event(self, event_type: EventType, business_id: UUID, entity_id: UUID, actor_id: UUID | None = None, description: str | None = None, data: dict | None = None) -> None:
        if self._event_service is None:
            return
        try:
            self._event_service.create_event(
                business_id=business_id, event_type=event_type, entity_type="sales_order",
                entity_id=entity_id, actor_id=actor_id, description=description, data=data
            )
        except Exception:
            logger.warning("Failed to emit %s event", event_type.value, exc_info=True)

    def create(self, business_id: UUID, current_user: CurrentUser, data: OrderCreate) -> SalesOrder:
        if current_user.role not in ["owner", "manager", "staff"]:
            raise ValueError("Permission denied")

        # Create order
        order_data = data.model_dump(exclude={"line_items"})
        order = self.repo.create(business_id=business_id, **order_data)

        # Create line items
        for item in data.line_items:
            self.repo.create_line_item(order_id=order.id, **item.model_dump())

        self._emit_event(
            event_type=EventType.ORDER_CREATED,
            business_id=business_id,
            entity_id=order.id,
            actor_id=current_user.user_id,
            description=f"Sales order {order.order_number} created",
            data={"order_number": order.order_number, "total_amount": float(order.total_amount)}
        )

        return order

    def get(self, business_id: UUID, current_user: CurrentUser, order_id: UUID) -> SalesOrder | None:
        return self.repo.get(business_id=business_id, entity_id=order_id)

    def list(self, business_id: UUID, current_user: CurrentUser, skip: int = 0, limit: int = 100) -> tuple[list[SalesOrder], int]:
        return self.repo.list(business_id=business_id, skip=skip, limit=limit), self.repo.count(business_id=business_id)

    def update(self, business_id: UUID, current_user: CurrentUser, order_id: UUID, data: OrderUpdate) -> SalesOrder | None:
        if current_user.role not in ["owner", "manager"]:
            raise ValueError("Permission denied")

        order = self.repo.get(business_id=business_id, entity_id=order_id)
        if not order:
            return None

        old_status = order.status
        updated_order = self.repo.update(business_id=business_id, entity_id=order_id, **data.model_dump(exclude_unset=True))

        if updated_order and data.status and data.status != old_status:
            # Determine appropriate event based on status change
            event_type = EventType.ORDER_CREATED # Default fallback
            if data.status == "confirmed":
                event_type = EventType.ORDER_CONFIRMED
            elif data.status == "shipped":
                event_type = EventType.ORDER_SHIPPED
            elif data.status == "delivered":
                event_type = EventType.ORDER_DELIVERED
            elif data.status == "cancelled":
                event_type = EventType.ORDER_CANCELLED
                
            self._emit_event(
                event_type=event_type,
                business_id=business_id,
                entity_id=order_id,
                actor_id=current_user.user_id,
                description=f"Sales order status changed to {data.status}",
                data={"old_status": old_status, "new_status": data.status}
            )

        return updated_order

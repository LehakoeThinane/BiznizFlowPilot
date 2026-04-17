"""Lead model - sales pipeline entity."""

from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class Lead(BaseModel):
    """Lead entity.
    
    Represents a potential customer in the sales pipeline.
    Belongs to a business and optionally a customer.
    """

    __tablename__ = "leads"

    business_id = Column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
        doc="Tenant ID - CRITICAL FOR MULTI-TENANCY",
    )

    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Associated customer (optional)",
    )

    assigned_to = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="User responsible for this lead",
    )

    status = Column(
        String(50),
        default="new",
        nullable=False,
        index=True,
        doc="Pipeline status: new, contacted, qualified, won, lost",
    )

    source = Column(
        String(100),
        nullable=True,
        doc="Lead source: web_form, referral, cold_call, etc.",
    )

    value = Column(
        String(50),
        nullable=True,
        doc="Estimated deal value",
    )

    notes = Column(
        Text,
        nullable=True,
        doc="Lead notes and history",
    )

    def __repr__(self) -> str:
        """String representation."""
        return f"<Lead id={self.id} status='{self.status}'>"

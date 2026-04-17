"""Business model - represents a tenant."""

from sqlalchemy import Column, String

from app.models.base import BaseModel


class Business(BaseModel):
    """Business/tenant entity."""

    __tablename__ = "businesses"

    name = Column(
        String(255),
        nullable=False,
        index=True,
        doc="Business name",
    )

    email = Column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
        doc="Business contact email",
    )

    phone = Column(
        String(20),
        nullable=True,
        doc="Business phone number",
    )

    def __repr__(self) -> str:
        """String representation."""
        return f"<Business id={self.id} name='{self.name}'>"

"""Invoice API — create, list, update status, line items."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated
from uuid import UUID, uuid4

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.invoice import Invoice, InvoiceLineItem
from app.schemas.auth import CurrentUser
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceListItem,
    InvoiceListResponse,
    InvoiceOut,
    InvoiceStatusUpdate,
)

router = APIRouter(prefix="/api/v1/invoices", tags=["invoices"])

_INVOICE_PREFIX = "INV"


def _require_manager(user: CurrentUser) -> None:
    if user.role not in ("owner", "manager"):
        raise HTTPException(status_code=403, detail="Owner or manager required")


def _next_invoice_number(db: Session, business_id: UUID) -> str:
    count = db.query(sa.func.count(Invoice.id)).filter(
        Invoice.business_id == business_id
    ).scalar() or 0
    return f"{_INVOICE_PREFIX}-{count + 1:05d}"


def _build_line_items(
    invoice_id: UUID, items_data: list
) -> tuple[list[InvoiceLineItem], Decimal, Decimal, Decimal]:
    line_items = []
    subtotal = Decimal("0")
    tax_amount = Decimal("0")
    discount_amount = Decimal("0")
    for item in items_data:
        line_subtotal = item.quantity * item.unit_price
        disc = line_subtotal * (item.discount_percent / Decimal("100"))
        after_disc = line_subtotal - disc
        tax = after_disc * (item.tax_rate / Decimal("100"))
        li = InvoiceLineItem(
            id=uuid4(),
            invoice_id=invoice_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount_percent=item.discount_percent,
            tax_rate=item.tax_rate,
            subtotal=after_disc + tax,
        )
        line_items.append(li)
        subtotal += line_subtotal
        discount_amount += disc
        tax_amount += tax
    return line_items, subtotal, tax_amount, discount_amount


def _invoice_out(inv: Invoice, db: Session) -> InvoiceOut:
    out = InvoiceOut.model_validate(inv)
    if inv.customer:
        out.customer_name = inv.customer.name
    return out


@router.get("", response_model=InvoiceListResponse)
def list_invoices(
    skip: int = 0,
    limit: int = 20,
    status: str | None = None,
    customer_id: UUID | None = None,
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    q = db.query(Invoice).filter(Invoice.business_id == current_user.business_id)
    if status:
        q = q.filter(Invoice.status == status)
    if customer_id:
        q = q.filter(Invoice.customer_id == customer_id)
    total = q.count()
    rows = q.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()
    items = []
    for inv in rows:
        item = InvoiceListItem.model_validate(inv)
        if inv.customer:
            item.customer_name = inv.customer.name
        items.append(item)
    return InvoiceListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/{inv_id}", response_model=InvoiceOut)
def get_invoice(
    inv_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    inv = db.query(Invoice).filter(
        Invoice.id == inv_id, Invoice.business_id == current_user.business_id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return _invoice_out(inv, db)


@router.post("", response_model=InvoiceOut, status_code=201)
def create_invoice(
    data: InvoiceCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    inv_id = uuid4()
    line_items, subtotal, tax_amount, discount_amount = _build_line_items(
        inv_id, data.line_items
    )
    total_amount = subtotal - discount_amount + tax_amount

    inv = Invoice(
        id=inv_id,
        business_id=current_user.business_id,
        invoice_number=_next_invoice_number(db, current_user.business_id),
        customer_id=data.customer_id,
        sales_order_id=data.sales_order_id,
        issue_date=data.issue_date,
        due_date=data.due_date,
        payment_terms=data.payment_terms,
        notes=data.notes,
        subtotal=subtotal,
        tax_amount=tax_amount,
        discount_amount=discount_amount,
        total_amount=total_amount,
        status="draft",
    )
    db.add(inv)
    db.flush()
    for li in line_items:
        db.add(li)
    db.commit()
    db.refresh(inv)
    return _invoice_out(inv, db)


@router.patch("/{inv_id}/status", response_model=InvoiceOut)
def update_invoice_status(
    inv_id: UUID,
    data: InvoiceStatusUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    _require_manager(current_user)
    inv = db.query(Invoice).filter(
        Invoice.id == inv_id, Invoice.business_id == current_user.business_id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    inv.status = data.status
    if data.status == "paid":
        from datetime import date
        inv.paid_at = date.today()
    elif data.status == "sent":
        inv.sent_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(inv)
    return _invoice_out(inv, db)


@router.delete("/{inv_id}", status_code=204)
def delete_invoice(
    inv_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    _require_manager(current_user)
    inv = db.query(Invoice).filter(
        Invoice.id == inv_id, Invoice.business_id == current_user.business_id
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Only draft invoices can be deleted")
    db.delete(inv)
    db.commit()

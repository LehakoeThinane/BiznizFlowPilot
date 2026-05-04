"""Finance API — expense categories, expenses, P&L summary."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated
from uuid import UUID, uuid4

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.finance import Expense, ExpenseCategory
from app.models.sales_order import SalesOrder
from app.schemas.auth import CurrentUser
from app.schemas.finance import (
    CategoryTotal,
    ExpenseCategoryCreate,
    ExpenseCategoryOut,
    ExpenseCategoryUpdate,
    ExpenseCreate,
    ExpenseListResponse,
    ExpenseOut,
    ExpenseUpdate,
    FinanceSummary,
)

router = APIRouter(prefix="/api/v1/finance", tags=["finance"])

_REVENUE_STATUSES = ("confirmed", "processing", "shipped", "delivered")


def _require_manager(user: CurrentUser) -> None:
    if user.role not in ("owner", "manager"):
        raise HTTPException(status_code=403, detail="Owner or manager required")


def _period_bounds(period: str) -> tuple[date, date, str]:
    now = datetime.now(timezone.utc)
    y, m = now.year, now.month
    if period == "this_month":
        start = date(y, m, 1)
        end = now.date()
        label = now.strftime("%B %Y")
    elif period == "last_month":
        if m == 1:
            y, m = y - 1, 12
        else:
            m -= 1
        import calendar
        last_day = calendar.monthrange(y, m)[1]
        start = date(y, m, 1)
        end = date(y, m, last_day)
        label = date(y, m, 1).strftime("%B %Y")
    elif period == "ytd":
        start = date(y, 1, 1)
        end = now.date()
        label = f"YTD {y}"
    else:  # this_year
        start = date(y, 1, 1)
        end = date(y, 12, 31)
        label = str(y)
    return start, end, label


def _expense_out(exp: Expense) -> ExpenseOut:
    out = ExpenseOut.model_validate(exp)
    out.category_name = exp.category.name if exp.category else None
    return out


# ── Summary ────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=FinanceSummary)
def get_summary(
    period: str = "this_month",
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    start, end, label = _period_bounds(period)
    bid = current_user.business_id

    revenue = (
        db.query(sa.func.coalesce(sa.func.sum(SalesOrder.total_amount), 0))
        .filter(
            SalesOrder.business_id == bid,
            SalesOrder.status.in_(_REVENUE_STATUSES),
            sa.func.date(SalesOrder.order_date) >= start,
            sa.func.date(SalesOrder.order_date) <= end,
        )
        .scalar()
    )

    expenses_total = (
        db.query(sa.func.coalesce(sa.func.sum(Expense.amount), 0))
        .filter(
            Expense.business_id == bid,
            Expense.date >= start,
            Expense.date <= end,
        )
        .scalar()
    )

    by_cat_rows = (
        db.query(
            sa.func.coalesce(ExpenseCategory.name, "Uncategorised"),
            sa.func.sum(Expense.amount),
        )
        .outerjoin(ExpenseCategory, Expense.category_id == ExpenseCategory.id)
        .filter(Expense.business_id == bid, Expense.date >= start, Expense.date <= end)
        .group_by(ExpenseCategory.name)
        .all()
    )

    return FinanceSummary(
        period_label=label,
        revenue=Decimal(str(revenue)),
        expenses=Decimal(str(expenses_total)),
        net_profit=Decimal(str(revenue)) - Decimal(str(expenses_total)),
        expense_by_category=[CategoryTotal(name=r[0], amount=Decimal(str(r[1]))) for r in by_cat_rows],
    )


# ── Categories ─────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[ExpenseCategoryOut])
def list_categories(
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    return db.query(ExpenseCategory).filter(
        ExpenseCategory.business_id == current_user.business_id,
        ExpenseCategory.is_active.is_(True),
    ).order_by(ExpenseCategory.name).all()


@router.post("/categories", response_model=ExpenseCategoryOut, status_code=201)
def create_category(
    data: ExpenseCategoryCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    _require_manager(current_user)
    cat = ExpenseCategory(id=uuid4(), business_id=current_user.business_id, **data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/categories/{cat_id}", response_model=ExpenseCategoryOut)
def update_category(
    cat_id: UUID,
    data: ExpenseCategoryUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    _require_manager(current_user)
    cat = db.query(ExpenseCategory).filter(
        ExpenseCategory.id == cat_id,
        ExpenseCategory.business_id == current_user.business_id,
    ).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return cat


# ── Expenses ───────────────────────────────────────────────────────────────

@router.get("/expenses", response_model=ExpenseListResponse)
def list_expenses(
    skip: int = 0,
    limit: int = 20,
    category_id: UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    q = db.query(Expense).filter(Expense.business_id == current_user.business_id)
    if category_id:
        q = q.filter(Expense.category_id == category_id)
    if from_date:
        q = q.filter(Expense.date >= from_date)
    if to_date:
        q = q.filter(Expense.date <= to_date)
    total = q.count()
    rows = q.order_by(Expense.date.desc()).offset(skip).limit(limit).all()
    return ExpenseListResponse(
        items=[_expense_out(e) for e in rows],
        total=total, skip=skip, limit=limit,
    )


@router.post("/expenses", response_model=ExpenseOut, status_code=201)
def create_expense(
    data: ExpenseCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    exp = Expense(
        id=uuid4(),
        business_id=current_user.business_id,
        paid_by=current_user.user_id,
        **data.model_dump(),
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return _expense_out(exp)


@router.patch("/expenses/{exp_id}", response_model=ExpenseOut)
def update_expense(
    exp_id: UUID,
    data: ExpenseUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    exp = db.query(Expense).filter(
        Expense.id == exp_id, Expense.business_id == current_user.business_id
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(exp, k, v)
    db.commit()
    db.refresh(exp)
    return _expense_out(exp)


@router.delete("/expenses/{exp_id}", status_code=204)
def delete_expense(
    exp_id: UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    _require_manager(current_user)
    exp = db.query(Expense).filter(
        Expense.id == exp_id, Expense.business_id == current_user.business_id
    ).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(exp)
    db.commit()

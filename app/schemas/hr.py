"""HR & Payroll schemas."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ── Departments ────────────────────────────────────────────────────────────

class DepartmentCreate(BaseModel):
    name: str
    description: str | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    business_id: UUID
    name: str
    description: str | None
    is_active: bool
    employee_count: int = 0
    created_at: datetime


# ── Employees ──────────────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    department_id: UUID | None = None
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
    position: str | None = None
    employment_type: str = "full_time"
    salary_type: str = "monthly"
    gross_salary: Decimal = Decimal("0")
    start_date: date | None = None
    national_id: str | None = None
    tax_number: str | None = None
    bank_account: str | None = None
    notes: str | None = None


class EmployeeUpdate(BaseModel):
    department_id: UUID | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    position: str | None = None
    employment_type: str | None = None
    salary_type: str | None = None
    gross_salary: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None
    national_id: str | None = None
    tax_number: str | None = None
    bank_account: str | None = None
    notes: str | None = None


class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    business_id: UUID
    department_id: UUID | None
    first_name: str
    last_name: str
    full_name: str = ""
    email: str | None
    phone: str | None
    position: str | None
    employment_type: str
    salary_type: str
    gross_salary: Decimal
    start_date: date | None
    end_date: date | None
    is_active: bool
    department_name: str | None = None
    created_at: datetime


class EmployeeListResponse(BaseModel):
    items: list[EmployeeOut]
    total: int
    skip: int
    limit: int


# ── Leave ──────────────────────────────────────────────────────────────────

class LeaveTypeCreate(BaseModel):
    name: str
    default_days: Decimal = Decimal("0")
    is_paid: bool = True


class LeaveTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    default_days: Decimal
    is_paid: bool
    is_active: bool


class LeaveRequestCreate(BaseModel):
    employee_id: UUID
    leave_type_id: UUID | None = None
    start_date: date
    end_date: date
    days_requested: Decimal
    reason: str | None = None


class LeaveStatusUpdate(BaseModel):
    status: str
    notes: str | None = None


class LeaveRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    employee_id: UUID
    employee_name: str = ""
    leave_type_id: UUID | None
    leave_type_name: str | None = None
    start_date: date
    end_date: date
    days_requested: Decimal
    status: str
    reason: str | None
    approved_by: UUID | None
    approved_at: datetime | None
    created_at: datetime


class LeaveListResponse(BaseModel):
    items: list[LeaveRequestOut]
    total: int
    skip: int
    limit: int


# ── Payroll ────────────────────────────────────────────────────────────────

class PayrollGenerateRequest(BaseModel):
    period_year: int
    period_month: int
    notes: str | None = None


class PayslipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    employee_id: UUID
    employee_name: str = ""
    basic_pay: Decimal
    overtime_pay: Decimal
    bonus: Decimal
    gross_pay: Decimal
    tax_deduction: Decimal
    uif_deduction: Decimal
    other_deductions: Decimal
    total_deductions: Decimal
    net_pay: Decimal
    status: str


class PayrollPeriodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    period_year: int
    period_month: int
    status: str
    total_gross: Decimal
    total_deductions: Decimal
    total_net: Decimal
    processed_at: datetime | None
    created_at: datetime
    payslips: list[PayslipOut] = []

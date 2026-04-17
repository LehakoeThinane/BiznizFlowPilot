# BiznizFlowPilot

BiznizFlowPilot is a multi-tenant operations automation platform designed for small businesses. It helps SMMEs manage leads, tasks, follow-ups, and internal workflows through a structured event-driven backend.

The system is being built with a layered architecture and a product-first approach, with a focus on operational reliability, automation, and clear separation of responsibilities across the API, domain, data, and workflow layers.

## Problem It Solves

Many small businesses lose leads, forget follow-ups, and rely on scattered tools such as WhatsApp, spreadsheets, and email to manage day-to-day operations. BiznizFlowPilot is designed to centralize those workflows and reduce manual coordination.

## Current Scope

At this stage, the platform supports the foundational backend required to evolve into a full operations automation system.

Implemented up to Phase 3:

- **Phase 1: Foundation**
  - FastAPI project setup
  - PostgreSQL integration
  - JWT authentication
  - Multi-tenant business isolation

- **Phase 2: Core CRM Layer**
  - Customers
  - Leads
  - Tasks
  - Role-based access control (Owner, Manager, Staff)

- **Phase 3: Event System**
  - Event creation for core business actions
  - Event storage and tracking with metadata
  - Event processing foundation for workflow orchestration
  - Audit trail for all entities

## Architecture Principles

BiznizFlowPilot is being designed around the following principles:

- **Layered architecture**: API → Services → Repositories → Models → Database
- **Multi-tenant data isolation**: Every query filters by `business_id`
- **Event-driven system design**: All business actions emit events for workflow processing
- **Clear separation of concerns**: API handles requests, services contain business logic, repositories enforce data access, models define schema
- **Async-ready processing**: Redis and Celery configured for future workflow execution
- **Role-based access control**: Owner, Manager, Staff roles with granular permissions

## Tech Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy
- **Migrations**: Alembic
- **Cache/Queue**: Redis, Celery
- **Validation**: Pydantic
- **Authentication**: JWT (PyJWT)
- **Password Hashing**: bcrypt
- **Testing**: pytest

## Project Structure

```
app/
  api/              # FastAPI route handlers
  core/             # Configuration, security, database
  models/           # SQLAlchemy ORM models
  schemas/          # Pydantic request/response schemas
  repositories/     # Data access layer with multi-tenancy enforcement
  services/         # Business logic layer
  workers/          # Celery task workers (placeholder)
  utils/            # Logging and utilities
  dependencies.py   # FastAPI dependency injection

tests/              # Comprehensive test suite
migrations/         # Alembic database migrations
```

## Roadmap

- Phase 1: Foundation ✅
- Phase 2: Core CRM ✅
- Phase 3: Event System ✅
- Phase 4: Workflow Engine
- Phase 5: Async Processing and Notifications
- Phase 6: Dashboard and Reporting

## Current Status

**Development stage**: Phase 3 completed

**Next objectives**:
- Implement workflow definitions and evaluation logic
- Build action execution engine
- Introduce workflow run logging and monitoring

## Running the Project

### Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database and API settings

# Run migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload
```

### Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app tests/

# Run specific test file
pytest tests/test_auth.py
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new business and owner
- `POST /api/v1/auth/login` - Login and get JWT tokens

### Customers
- `POST /api/v1/customers` - Create customer
- `GET /api/v1/customers` - List customers
- `GET /api/v1/customers/{id}` - Get customer
- `PATCH /api/v1/customers/{id}` - Update customer
- `DELETE /api/v1/customers/{id}` - Delete customer

### Leads
- `POST /api/v1/leads` - Create lead
- `GET /api/v1/leads` - List leads (filtered by status, assignment)
- `GET /api/v1/leads/{id}` - Get lead
- `PATCH /api/v1/leads/{id}` - Update lead (with state validation)
- `POST /api/v1/leads/{id}/assign/{user_id}` - Assign lead
- `DELETE /api/v1/leads/{id}` - Delete lead

### Tasks
- `POST /api/v1/tasks` - Create task
- `GET /api/v1/tasks` - List tasks (filtered by status, overdue)
- `GET /api/v1/tasks/{id}` - Get task
- `PATCH /api/v1/tasks/{id}` - Update task
- `POST /api/v1/tasks/{id}/assign/{user_id}` - Assign task
- `DELETE /api/v1/tasks/{id}` - Delete task

### Events
- `POST /api/v1/events` - Create event
- `GET /api/v1/events` - List events (filtered by type, entity, unprocessed)
- `GET /api/v1/events/{id}` - Get event
- `PATCH /api/v1/events/{id}` - Mark event as processed
- `GET /api/v1/events/audit-trail/{entity_type}/{entity_id}` - Get audit trail

## Multi-Tenancy

Every table has a `business_id` foreign key. All queries automatically filter by the current user's `business_id`, enforced at the repository layer. This prevents data leaks between businesses by design.

```python
# Example: Get lead for business
lead = repository.get(business_id=current_user.business_id, entity_id=lead_id)
```

## Role-Based Access Control

Three roles with varying permissions:

- **Owner**: Full access to all entities, can permanently delete data
- **Manager**: Can create/assign/edit entities, cannot permanently delete
- **Staff**: Can view assigned items, update own status, cannot assign/create

RBAC is enforced at the service layer with explicit role checks.

## Development Note

This project is intentionally being built as a systems-focused backend platform, not as a UI-first prototype. The goal is to establish a strong architectural foundation before introducing advanced workflow tooling, integrations, or AI-assisted features.

The codebase prioritizes:
- Clear separation of concerns
- Multi-tenant safety by design
- Comprehensive testing
- Documented API contracts
- Operational reliability

---

**Status**: In active development | **Last Updated**: April 17, 2026

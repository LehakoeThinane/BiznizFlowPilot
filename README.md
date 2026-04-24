# BiznizFlowPilot

BiznizFlowPilot is a multi-tenant, event-driven workflow automation backend.
It is built as platform infrastructure that can power other products, not as a UI-first application.

## What It Provides

- JWT-authenticated multi-tenant API
- CRM entities (`customers`, `leads`, `tasks`)
- Event ingestion with audit trail
- Workflow definition CRUD with validation and soft delete
- Async dispatch/execution model with Celery workers
- Retry orchestration and stale-work recovery loops
- Pluggable action handlers (`create_task`, `webhook`, `send_email`)
- Tenant-scoped operational metrics (`GET /api/v1/metrics`)

## Current Build Status

- Phase 1: Foundation ✅
- Phase 2: Core CRM ✅
- Phase 3: Event System ✅
- Phase 4: Workflow Dispatch ✅
- Phase 5: Async Execution + Recovery ✅
- Phase 6: Definition Management + Context/Templating ✅

Load-test harnesses are implemented (PostgreSQL-gated) for:

- concurrency and duplicate prevention
- mixed volume outcomes and timeout behavior
- recovery performance at scale
- tenant isolation and cross-tenant leakage checks

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

Core layering:

- API -> Services -> Repositories -> Models -> Database

Core runtime flow:

- event claim -> dispatch runs/actions -> execute actions -> retry/requeue -> recovery

## Tech Stack

- FastAPI
- SQLAlchemy + Alembic
- PostgreSQL
- Redis + Celery
- Pydantic v2
- pytest

## Project Structure

```
app/
  api/              # FastAPI route handlers
  core/             # config, security, database
  models/           # SQLAlchemy models
  repositories/     # data access and query boundaries
  schemas/          # Pydantic request/response models
  services/         # business logic
  workflow_engine/  # dispatch/executor/handlers/context
  workers/          # Celery task entry points

tests/
  load/             # PostgreSQL-gated load validation suites

migrations/         # Alembic revisions
```

## Running Locally

### Docker Database

If you want a lighter setup than the installed PostgreSQL/pgAdmin desktop apps, run PostgreSQL in Docker:

```powershell
docker compose up -d db
```

Optional pgAdmin container:

```powershell
docker compose --profile tools up -d
```

The database connection string stays:

```text
postgresql://postgres:020890@localhost:5433/biznizflow_test
```

To stop and remove the containers:

```powershell
docker compose down
```

If you change the database password or want a fresh local database, reset the data volume:

```powershell
docker compose down -v
```

### Setup

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
alembic -c migrations/alembic.ini upgrade head
uvicorn app.main:app --reload --reload-dir app
```

Or on Windows:

```powershell
.\scripts\start-backend.ps1
```

### Tests

```bash
pytest
pytest tests/test_metrics_api.py
pytest tests/load/ -v   # requires PostgreSQL DATABASE_URL
```

## API Surface (high level)

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/me`

### CRM

- `customers`, `leads`, `tasks` CRUD routes under `/api/v1/*`

### Events

- `POST /api/v1/events`
- `GET /api/v1/events`
- `GET /api/v1/events/{event_id}`
- `PATCH /api/v1/events/{event_id}`
- `GET /api/v1/events/audit-trail/{entity_type}/{entity_id}`

### Workflows

- legacy workflow routes: `/api/v1/workflows/*`
- workflow-definition CRUD: `/api/v1/workflow-definitions/*`

### Metrics

- `GET /api/v1/metrics`
  - returns aggregate run/action/definition counts
  - scoped to caller tenant (`business_id` optional but must match caller)

## Multi-Tenancy and RBAC

- Every critical query is tenant-scoped by `business_id`
- Context resolution enforces tenant filtering on entity loads
- Roles: `owner`, `manager`, `staff`
- Privileged actions (definition mutation, certain event operations) use role guards

## Next Hardening Targets

- metrics export pipeline (Prometheus/CloudWatch/Datadog)
- per-tenant rate limiting and backpressure controls
- production dashboards/alerting built on emitted metrics

---

**Status**: Active development backend platform  
**Last Updated**: April 22, 2026


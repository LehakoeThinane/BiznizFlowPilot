# BiznizFlowPilot Architecture

## 1) What It Is

BiznizFlowPilot is a multi-tenant, event-driven workflow automation backend.
It is designed as platform infrastructure, not a UI-first app.

Primary capabilities:

- multi-tenant CRM data model (`business_id`-scoped)
- event ingestion and dispatch
- workflow definition CRUD
- asynchronous workflow execution with retries
- recovery loops for stale claims/runs/retries
- pluggable action handlers

## 2) Core Concepts

### Events

Business actions emit `Event` rows (for example `lead_created`, `task_assigned`).
Event lifecycle:

- `PENDING` -> `CLAIMED` -> `DISPATCHED` or `FAILED`

### Workflow Definitions

`WorkflowDefinition` binds an `event_type` to ordered action configs.
Definitions are tenant-scoped and support soft delete (`deleted_at`).

### Workflow Runs

When an event matches active definitions, the dispatcher creates `WorkflowRun` rows.
Run lifecycle:

- `QUEUED` -> `RUNNING` -> `COMPLETED` or `FAILED`

Each run stores `definition_snapshot` for immutable auditability.

### Workflow Actions

Dispatcher materializes each configured action into a `WorkflowAction` row.
Action lifecycle:

- `PENDING` -> `RUNNING` -> `COMPLETED` / `FAILED` / `SKIPPED` / `RETRY_SCHEDULED`

`config_snapshot` is the canonical execution payload for handlers.

## 3) Execution Model

## Dispatch phase

1. Event worker claims oldest pending event (`skip_locked`)
2. Dispatcher resolves matching definitions
3. For each definition:
   - create run
   - materialize actions
   - savepoint protects partial failures
4. Event marked `DISPATCHED` on success, `FAILED` on unrecoverable error

## Execute phase

1. Executor claims oldest queued run (`skip_locked`)
2. Run moves to `RUNNING` and gets `started_at`
3. Executor processes enabled pending actions in `execution_order`
4. Handler returns normalized `ActionResult`
5. Retryable failures become `RETRY_SCHEDULED` with `next_retry_at`
6. Terminal failures fail the run unless `continue_on_failure=true`
7. Run moves to terminal state and gets `finished_at`

## Recovery phase (Beat)

Periodic tasks keep the system progressing:

- release stale claimed events
- requeue due action retries (and move runs back `RUNNING` -> `QUEUED`)
- fail stale running runs

## 4) Extensibility

## Add a new action type

1. Add typed config in `app/workflow_engine/action_config.py`
2. Implement handler (`ActionHandler.execute`)
3. Register handler in `build_default_action_registry`
4. Add tests for success/failure/retry behavior

No executor branch logic is required for new action types.

## Add new trigger behavior

- add event enum/type
- emit event from service layer
- create/update workflow definitions for the new type

## 5) Operational Model

## Multi-tenancy and safety

- every entity is scoped by `business_id`
- repository queries enforce tenant filters
- context resolver always loads entities by both `id` and `business_id`
- load isolation tests validate cross-tenant leakage protection

## Observability

- run/action timing: `started_at`, `finished_at`, `executed_at`
- structured logs:
  - `executor.run.claimed`
  - `handler.action.start`
  - `handler.action.complete` / `handler.action.failed`
  - `executor.run.completed` / `executor.run.failed`
- aggregate metrics endpoint: `GET /api/v1/metrics`

## Load validation

Load suites (PostgreSQL-gated) cover:

- concurrent claiming
- duplicate prevention
- mixed success/failure/retry volume behavior
- slow-handler timeout behavior
- recovery performance under skew
- tenant isolation under concurrent execution

## Layering contract

Code organization follows:

- API routes: HTTP translation only
- Services: business rules and orchestration
- Repositories: data-access boundaries
- Workflow engine: dispatch/execution/runtime concerns

This separation keeps transaction boundaries explicit and testable.


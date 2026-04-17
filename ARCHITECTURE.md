# BiznizFlowPilot – System Architecture

---

## 1. Architecture Overview

### Layered Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│         Presentation Layer (React)              │
│         Dashboard, Forms, Workflows             │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│         API Layer (FastAPI)                     │
│  /api/v1/leads, /api/v1/tasks, /api/v1/users  │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│       Business Logic Layer (Services)           │
│  LeadService, TaskService, WorkflowService     │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│      Data Access Layer (Repositories)           │
│  LeadRepository, TaskRepository, etc.           │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│       Database Layer (PostgreSQL)               │
│  businesses, users, leads, tasks, workflows     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│       Event & Queue Layer (Redis + Celery)      │
│  Async job processing, delayed tasks, retries   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│       Integration Layer                         │
│  Email Services, Webhooks, External APIs        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│       Security Layer                            │
│  JWT Auth, RBAC, Tenant Isolation               │
└─────────────────────────────────────────────────┘
```

---

## 2. Core Components

### 2.1 API Layer (FastAPI)

**Responsibilities:**
- Request handling and validation
- Route definition
- Error handling
- Response serialization

**Key Routes:**
- `/api/v1/auth/` - Authentication
- `/api/v1/users/` - User management
- `/api/v1/customers/` - Customer CRUD
- `/api/v1/leads/` - Lead management
- `/api/v1/tasks/` - Task management
- `/api/v1/workflows/` - Workflow definition
- `/api/v1/dashboard/` - Metrics & summaries

---

### 2.2 Business Logic Layer (Services)

**Core Services:**

| Service | Responsibility |
|---------|---|
| `AuthService` | JWT token generation, user authentication |
| `LeadService` | Lead lifecycle, status transitions |
| `TaskService` | Task creation, assignment, completion |
| `WorkflowService` | Workflow rule management, execution |
| `EventService` | Event creation and publishing |
| `NotificationService` | Email & in-app notifications |
| `UserService` | User CRUD, role assignment |

**Pattern:** Services encapsulate business rules and orchestrate repositories.

---

### 2.3 Data Access Layer (Repositories)

**Pattern:** Repository pattern for database abstraction.

**Key Repositories:**
- `LeadRepository` - Lead queries
- `TaskRepository` - Task queries
- `WorkflowRepository` - Workflow rules
- `EventRepository` - Event logs
- `NotificationRepository` - Notification records
- `UserRepository` - User records

**Benefits:**
- Decoupled data access from business logic
- Testable code
- Easy to switch databases

---

### 2.4 Workflow Engine

**Design:**

```
TRIGGER (event) → CONDITION (evaluation) → ACTION (execution)
```

**Example Workflow Rule:**

```
IF event = "lead.created"
AND lead.source = "web_form"
THEN:
  - Assign to available manager
  - Create "Follow-up" task (24h)
  - Send email notification
  - Log workflow execution
```

**Execution Flow:**

1. Event published to message queue
2. Workflow engine processes event
3. Evaluates all matching rules
4. Executes actions (async)
5. Logs result

---

### 2.5 Event & Queue Layer

**Technologies:**
- **Redis** - Message broker & caching
- **Celery** - Async task queue
- **Python** - Task definitions

**Event Types:**
- `lead.created`
- `lead.status_changed`
- `task.created`
- `task.overdue`
- `workflow.triggered`

**Async Operations:**
- Send notifications
- Execute workflow actions
- Generate reports
- Cleanup operations

---

### 2.6 Database Layer (PostgreSQL)

**Key Design Principles:**
- UUID primary keys (not auto-increment integers)
- JSONB for flexible metadata
- Proper indexing for performance
- Multi-tenant isolation via `business_id`

**Core Tables:**

```sql
-- Multi-tenant root
businesses (id, name, created_at)

-- Users & Access
users (id, business_id, email, role, created_at)

-- CRM Core
customers (id, business_id, name, email, phone, created_at)
leads (id, business_id, customer_id, status, assigned_to, created_at)

-- Task Management
tasks (id, business_id, lead_id, assigned_to, status, due_date, created_at)

-- Automation
workflows (id, business_id, name, trigger_event, conditions, actions, active)
workflow_runs (id, workflow_id, triggered_by, execution_status, result)
events (id, business_id, event_type, entity_type, entity_id, data, created_at)

-- Notifications & Logging
notifications (id, user_id, type, content, read, created_at)
activity_logs (id, business_id, actor, action, entity_type, entity_id, created_at)
```

---

## 3. Multi-Tenancy Strategy

**Approach:** Schema-per-tenant with shared infrastructure

**Key Points:**
- Each business has isolated data via `business_id`
- Row-level security via RBAC
- Tenant context included in every request
- JWT token holds `business_id` claim

**Isolation Checks:**

```python
# Example: All queries filtered by business_id
leads = db.query(Lead).filter(
    Lead.business_id == current_user.business_id
).all()
```

---

## 4. Security Architecture

### Authentication Flow

```
1. User submits email + password
2. AuthService verifies credentials
3. Generate JWT token with claims:
   - user_id
   - business_id
   - role
   - exp (expiration)
4. Return token to client
5. Client includes token in Authorization header
```

### Authorization (RBAC)

```
Owner:
  - Full system access
  - Manage workflows & users
  - View all business data

Manager:
  - Assign tasks
  - View team performance
  - View all leads/tasks

Staff:
  - View assigned leads/tasks
  - Update own task status
  - Cannot assign tasks
```

### Tenant Isolation

Every request must:
1. Include valid JWT token
2. JWT token contains `business_id`
3. All queries filtered by `business_id`
4. Database constraints prevent cross-tenant data access

---

## 5. Data Flow Examples

### Example 1: New Lead Created

```
1. API POST /api/v1/leads
   ├─ Validate input (LeadSchema)
   ├─ Extract business_id from JWT
   └─ Call LeadService.create_lead()

2. LeadService.create_lead()
   ├─ Create Lead object
   ├─ Save to database (LeadRepository)
   ├─ Publish event "lead.created"
   └─ Return lead object

3. Event Bus receives "lead.created"
   ├─ Store in events table
   ├─ Queue to Celery → workflow_processor task
   └─ Return immediately

4. Async Worker (Celery)
   ├─ Get all active workflows
   ├─ Evaluate trigger conditions
   ├─ For each matched workflow:
   │  ├─ Execute actions (assign, create task, notify)
   │  ├─ Log execution
   │  └─ Queue notifications
   └─ Complete

5. Notification Worker
   ├─ Send email notifications
   ├─ Create in-app notifications
   └─ Update notification status
```

### Example 2: Lead Status Changed to Won

```
1. API PATCH /api/v1/leads/{id}
   ├─ Update status to "Won"
   ├─ Call LeadService.update_lead()
   └─ Publish event "lead.status_changed"

2. WorkflowEngine evaluates:
   IF lead.status == "Won"
   THEN:
     - Create "Onboarding" task
     - Send "Congratulations" email
     - Log workflow execution

3. Async Actions:
   ├─ Create task in database
   ├─ Send email notification
   └─ Update activity log
```

---

## 6. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React, TypeScript | UI/UX |
| **API** | FastAPI, Pydantic | REST API, validation |
| **Database** | PostgreSQL | Primary data store |
| **ORM** | SQLAlchemy | Object-relational mapping |
| **Async** | Celery, Redis | Background jobs |
| **Auth** | PyJWT | Token generation |
| **Migrations** | Alembic | Schema versioning |
| **Testing** | pytest | Test suite |
| **Logging** | Python logging | Observability |

---

## 7. Performance Considerations

### API Response Time Target: <300ms

**Optimization Strategies:**
- Database indexing on frequently queried fields
- Redis caching for read-heavy operations
- Async processing for long-running tasks
- Connection pooling for database
- API response compression

**Key Indexes:**
- `leads.business_id, status, created_at`
- `tasks.assigned_to, status, due_date`
- `workflows.business_id, trigger_event`
- `users.email, business_id`

---

## 8. Scalability Plan

### Current (MVP)

```
Single FastAPI process + PostgreSQL + Redis
Suitable for: <1000 concurrent users
```

### Future Scaling

1. **Horizontal Scaling**
   - Multiple FastAPI instances behind load balancer
   - Shared PostgreSQL (read replicas)
   - Shared Redis

2. **Async Processing Scaling**
   - Multiple Celery worker processes
   - Redis Cluster for high throughput

3. **Database Optimization**
   - Sharding by business_id
   - Analytics databases (separate)
   - Caching layer (Redis)

---

## 9. Observability

### Logging Strategy

- Application logs (Python logging)
- Request/response logs
- Database query logs
- Event logs (workflow execution)
- Activity audit logs

### Metrics (Future)

- API response times
- Database query times
- Async job processing time
- Error rates
- Business metrics (leads, tasks, etc.)

---

## 10. Error Handling

### API Error Responses

```json
{
  "detail": "Resource not found",
  "error_code": "LEAD_NOT_FOUND",
  "status_code": 404
}
```

### Business Logic Errors

- Validation errors (bad input)
- Authorization errors (access denied)
- Not found errors (resource missing)
- Conflict errors (state violations)

### Async Job Errors

- Automatic retries (exponential backoff)
- Dead-letter queue for failed tasks
- Alert on critical failures

---

## 11. Deployment Architecture (Future)

```
Internet
   │
   ├─→ Load Balancer (Nginx)
   │
   ├─→ FastAPI Instance 1:8000
   ├─→ FastAPI Instance 2:8000
   ├─→ FastAPI Instance 3:8000
   │
   ├─→ PostgreSQL (Primary + Read Replicas)
   ├─→ Redis Cluster
   │
   ├─→ Celery Worker 1
   ├─→ Celery Worker 2
   └─→ Celery Worker 3
```

**Deployment Methods:**
- Docker containers
- Kubernetes orchestration (future)
- CI/CD pipeline (GitHub Actions)

---

## 12. Security Best Practices

- Secrets management (environment variables, vaults)
- HTTPS only
- CORS configuration
- Input validation & sanitization
- SQL injection prevention (ORM)
- Rate limiting
- Audit logging

---

## Summary

BiznizFlowPilot follows a **layered, service-oriented architecture** with:

- ✅ Clear separation of concerns
- ✅ Async processing for long-running tasks
- ✅ Multi-tenant data isolation
- ✅ Event-driven workflow automation
- ✅ Testable, maintainable code
- ✅ Scalable from day one

This foundation supports growth from MVP to enterprise without major refactoring.

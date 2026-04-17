# BiznizFlowPilot – Implementation Plan

---

## Overview

This document breaks down the implementation into **6 phases**, each with specific deliverables, milestones, and success criteria.

---

## Phase 1: Foundation (Week 1-2)

**Goal:** Set up the project infrastructure and essential systems.

### Deliverables

- [ ] FastAPI project initialized
- [ ] PostgreSQL database schema
- [ ] JWT authentication working
- [ ] Multi-tenant support in place
- [ ] Alembic migrations setup
- [ ] Basic error handling

### Key Files to Create

```
app/
├── main.py                          # FastAPI app entry
├── core/
│   ├── config.py                    # Configuration & environment
│   ├── constants.py                 # App constants
│   └── security.py                  # JWT utilities
├── models/
│   ├── __init__.py
│   ├── base.py                      # Base model with UUID, timestamps
│   ├── business.py                  # Business model
│   └── user.py                      # User model
├── schemas/
│   ├── __init__.py
│   ├── auth.py                      # Auth schemas
│   └── user.py                      # User schemas
├── repositories/
│   ├── __init__.py
│   ├── base.py                      # Base repository
│   └── user.py                      # User repository
├── services/
│   ├── __init__.py
│   ├── auth.py                      # Auth service
│   └── user.py                      # User service
├── api/
│   ├── __init__.py
│   ├── auth.py                      # Auth routes
│   └── users.py                     # User routes
└── utils/
    ├── __init__.py
    └── logger.py                    # Logging setup
```

### Tasks

1. **Project Setup**
   - Initialize FastAPI project
   - Setup virtual environment
   - Install core dependencies
   - Configure .env files

2. **Database Setup**
   - Create PostgreSQL database
   - Setup SQLAlchemy connection
   - Create base model with UUID + timestamps
   - Setup Alembic migrations

3. **Authentication**
   - Implement JWT token generation
   - Create auth service
   - Add middleware for token validation
   - Create auth routes (register, login)

4. **Multi-Tenant Support**
   - Add business_id to all models
   - Implement tenant context extraction
   - Add tenant filtering to repositories
   - Ensure all queries filter by business_id

5. **Error Handling**
   - Custom exception classes
   - Global exception handlers
   - Consistent error response format

### Success Criteria

- ✅ FastAPI server starts without errors
- ✅ Can register new user and business
- ✅ Can login and receive JWT token
- ✅ All user data filtered by business_id
- ✅ Database migrations work smoothly

### Dependencies to Install

```
fastapi==0.104.1
uvicorn==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
pydantic==2.5.0
python-jwt==1.7.1
python-dotenv==1.0.0
alembic==1.12.1
```

---

## Phase 2: Core CRM (Week 3-4)

**Goal:** Implement Lead, Task, and Customer management with RBAC.

### Deliverables

- [ ] Customers CRUD
- [ ] Leads CRUD with pipeline
- [ ] Tasks CRUD with assignment
- [ ] Role-based access control (RBAC)
- [ ] Activity logging

### Key Models

```python
# Models to create
- Customer (name, email, phone, business_id)
- Lead (customer_id, status, assigned_to, source, business_id)
- Task (lead_id, title, status, assigned_to, due_date, priority, business_id)
```

### Key Services

```python
# Services to implement
- LeadService (create, update, list, filter)
- TaskService (create, update, complete, assign)
- CustomerService (create, update, list)
- RBAC enforcement in all services
```

### API Endpoints

```
Customers:
  POST   /api/v1/customers
  GET    /api/v1/customers
  GET    /api/v1/customers/{id}
  PATCH  /api/v1/customers/{id}
  DELETE /api/v1/customers/{id}

Leads:
  POST   /api/v1/leads
  GET    /api/v1/leads (with filters: status, assigned_to)
  GET    /api/v1/leads/{id}
  PATCH  /api/v1/leads/{id}
  DELETE /api/v1/leads/{id}

Tasks:
  POST   /api/v1/tasks
  GET    /api/v1/tasks (with filters: status, assigned_to, due_date)
  GET    /api/v1/tasks/{id}
  PATCH  /api/v1/tasks/{id}
  DELETE /api/v1/tasks/{id}
```

### RBAC Rules

```
Owner:
  - Create/edit/delete customers, leads, tasks
  - Assign leads/tasks to anyone
  - View all data
  - Manage team members & roles

Manager:
  - Create/edit customers, leads
  - Assign leads/tasks to team members
  - View all leads/tasks
  - Edit own profile

Staff:
  - View assigned leads/tasks only
  - Update lead/task status
  - Cannot assign or delete
```

### Tasks

1. **Database Models**
   - Create Customer, Lead, Task models
   - Add proper relationships and constraints
   - Create Alembic migration

2. **Repositories**
   - LeadRepository, TaskRepository, CustomerRepository
   - Implement filtering (status, assigned_to, etc.)
   - Add pagination

3. **Services**
   - Business logic for each entity
   - Status validation (new → contacted → qualified → won/lost)
   - Task due date validation

4. **RBAC Middleware**
   - Decorator for role checking
   - Permission checking at service level
   - Audit logging of access

5. **API Routes**
   - Full CRUD for each entity
   - Proper validation using Pydantic schemas
   - User feedback (success/error messages)

6. **Testing**
   - Unit tests for services
   - Integration tests for API endpoints
   - RBAC permission tests

### Success Criteria

- ✅ Can create/view/update/delete customers
- ✅ Can create leads and move through pipeline
- ✅ Can create/assign tasks with due dates
- ✅ RBAC enforces permissions correctly
- ✅ All data filtered by business_id and user permissions
- ✅ >80% test coverage

---

## Phase 3: Event System (Week 5)

**Goal:** Implement event creation, storage, and triggering.

### Deliverables

- [ ] Event model and repository
- [ ] Event publishing system
- [ ] Event persistence
- [ ] Event type constants
- [ ] Event logging

### Key Components

```python
# Event types
- lead.created
- lead.status_changed
- task.created
- task.completed
- task.overdue (scheduled)
- workflow.triggered
```

### Tasks

1. **Event Model**
   - Create Event model
   - Fields: id, business_id, event_type, entity_type, entity_id, data, created_at
   - Indexing on business_id, event_type, created_at

2. **Event Publishing**
   - Create EventService
   - Publish method to trigger events
   - Serialize event data (JSON)

3. **Event Repository**
   - Query events by type
   - Query events by business
   - Query events by time range

4. **Event Integration**
   - Publish event when lead is created
   - Publish event when lead status changes
   - Publish event when task is created
   - Publish event when task is completed

5. **Testing**
   - Verify events are created
   - Verify events contain correct data
   - Test event querying

### Success Criteria

- ✅ Events created when entities change
- ✅ Events stored in database
- ✅ Can query events by type and business
- ✅ Event data structure is complete and consistent

---

## Phase 4: Workflow Engine (Week 6-7)

**Goal:** Build the rule-based automation engine.

### Deliverables

- [ ] Workflow model and repository
- [ ] Workflow rule evaluation engine
- [ ] Workflow action executor
- [ ] Workflow run tracking
- [ ] Workflow testing endpoint

### Key Workflows (MVP)

```
Workflow 1:
  Trigger: lead.created
  Condition: lead.source == "web_form"
  Actions:
    - Assign to available manager
    - Create follow-up task (24h)
    - Send email notification

Workflow 2:
  Trigger: lead.status_changed
  Condition: status == "qualified"
  Actions:
    - Create "proposal" task
    - Send internal notification

Workflow 3:
  Trigger: task.due_soon (24h before)
  Actions:
    - Send email reminder

Workflow 4:
  Trigger: lead.idle (no activity for 3 days)
  Actions:
    - Create "follow-up" task
    - Send manager notification
```

### Tasks

1. **Workflow Model**
   - Fields: id, business_id, name, trigger_event, conditions, actions, active, created_at
   - Store rules as JSON

2. **Rule Evaluation Engine**
   - Parse trigger conditions
   - Evaluate conditions against event data
   - Determine which rules match

3. **Action Executor**
   - Execute actions (create task, assign, send notification)
   - Handle action failures gracefully
   - Log execution results

4. **Workflow Run Tracking**
   - Store workflow execution history
   - Track status (pending, success, failed)
   - Store execution results

5. **Testing**
   - Create test endpoint: POST /api/v1/workflows/{id}/test
   - Test rule evaluation
   - Test action execution

### Workflow Structure (JSON)

```json
{
  "id": "uuid",
  "name": "New Lead Assignment",
  "trigger_event": "lead.created",
  "conditions": [
    {
      "field": "lead.source",
      "operator": "==",
      "value": "web_form"
    }
  ],
  "actions": [
    {
      "type": "assign_lead",
      "params": {
        "to_role": "manager"
      }
    },
    {
      "type": "create_task",
      "params": {
        "title": "Follow-up Call",
        "due_in_hours": 24
      }
    },
    {
      "type": "send_notification",
      "params": {
        "type": "email",
        "template": "new_lead_assigned"
      }
    }
  ]
}
```

### Success Criteria

- ✅ Workflow rules evaluate correctly
- ✅ Actions execute when conditions match
- ✅ Execution history stored
- ✅ Test endpoint works
- ✅ Can create/edit workflows

---

## Phase 5: Async Processing (Week 8)

**Goal:** Implement background job processing for scalability.

### Deliverables

- [ ] Redis connection setup
- [ ] Celery worker setup
- [ ] Task queue configuration
- [ ] Async workflow processing
- [ ] Async notifications
- [ ] Retry logic

### Tasks

1. **Redis Setup**
   - Install Redis locally / Docker
   - Configure connection pooling
   - Setup Redis cache layer

2. **Celery Configuration**
   - Initialize Celery app
   - Configure task routing
   - Setup worker process

3. **Async Tasks**
   - Create async workflow processor task
   - Create async notification task
   - Create async email sender task
   - Create scheduled task checker (for overdue items)

4. **Queue Integration**
   - Queue events to workflow processor
   - Queue notifications asynchronously
   - Add task to queue on event publish

5. **Retry Logic**
   - Exponential backoff for retries
   - Max retry count
   - Dead-letter queue for failed tasks

6. **Monitoring**
   - Task execution logs
   - Failed task alerts
   - Queue depth monitoring

### Key Async Tasks

```python
@celery.task(bind=True, max_retries=3)
def process_workflow_event(self, event_id):
    """Process event through workflow engine"""
    # Get event from database
    # Find matching workflows
    # Execute actions
    # Log results

@celery.task
def send_notification(notification_id):
    """Send email/in-app notification"""
    # Get notification
    # Send via email service
    # Update notification status

@celery.task
def check_overdue_tasks():
    """Scheduled task to check for overdue items"""
    # Find overdue tasks
    # Create notifications
    # Update dashboard
```

### Success Criteria

- ✅ Events processed asynchronously
- ✅ Notifications sent via queue
- ✅ Failed tasks retried automatically
- ✅ Worker processes events without blocking API
- ✅ <100ms latency for event publishing

---

## Phase 6: Dashboard & Metrics (Week 9)

**Goal:** Provide business visibility and operational metrics.

### Deliverables

- [ ] Dashboard summary schema
- [ ] Aggregation queries
- [ ] Real-time metrics
- [ ] Dashboard API endpoints
- [ ] List views with filtering

### Dashboard Components

```
1. Lead Overview
   - Total leads (this month)
   - Leads by status (pie chart)
   - Conversion rate
   - Average response time

2. Task Overview
   - Total tasks
   - Tasks by status
   - Overdue tasks
   - Completion rate

3. Team Performance
   - Leads per user
   - Tasks per user
   - Average task completion time

4. Workflow Activity
   - Last 10 executed workflows
   - Success rate
   - Failed workflows
```

### API Endpoints

```
GET /api/v1/dashboard/summary
  Returns:
  {
    "leads": {
      "total": 42,
      "by_status": { "new": 10, "contacted": 15, "qualified": 12, "won": 3, "lost": 2 },
      "this_month": 15,
      "conversion_rate": 7.1
    },
    "tasks": {
      "total": 156,
      "by_status": { "pending": 45, "in_progress": 32, "completed": 79 },
      "overdue": 3,
      "completion_rate": 50.6
    },
    "team": [
      {
        "user": "John Doe",
        "role": "manager",
        "leads_assigned": 15,
        "tasks_completed": 24
      }
    ]
  }

GET /api/v1/leads (with aggregation)
  - Group by status
  - Count by user
  - Filter by date range

GET /api/v1/workflows/activity
  - List recent workflow executions
  - Success/failure rates
```

### Tasks

1. **Aggregation Queries**
   - Write efficient SQL for metrics
   - Add caching for expensive queries
   - Pagination for large result sets

2. **Summary Endpoint**
   - Calculate all metrics
   - Return structured response
   - Cache for 5 minutes

3. **List Views**
   - Leads list with filtering
   - Tasks list with sorting
   - Workflow activity log

4. **Performance Optimization**
   - Index on status, assigned_to, created_at
   - Redis cache for metrics
   - Background job to pre-calculate metrics

5. **Testing**
   - Verify calculations are correct
   - Test filtering and sorting
   - Performance tests for large datasets

### Success Criteria

- ✅ Dashboard loads <500ms
- ✅ All metrics calculate correctly
- ✅ Filtering and sorting work
- ✅ Pagination works for large lists
- ✅ Caching improves performance

---

## Implementation Checklist by Phase

### Phase 1 Foundation
- [ ] FastAPI project initialized
- [ ] PostgreSQL connection working
- [ ] Alembic migrations setup
- [ ] JWT authentication working
- [ ] User and Business models created
- [ ] Multi-tenant support implemented

### Phase 2 Core CRM
- [ ] Customer model and CRUD
- [ ] Lead model and CRUD
- [ ] Task model and CRUD
- [ ] RBAC layer implemented
- [ ] Activity logging
- [ ] 80%+ test coverage

### Phase 3 Event System
- [ ] Event model created
- [ ] EventService implemented
- [ ] Events published on entity changes
- [ ] Event querying working
- [ ] Tests passing

### Phase 4 Workflow Engine
- [ ] Workflow model created
- [ ] Rule evaluation engine built
- [ ] Action executor implemented
- [ ] Workflow run tracking
- [ ] Test endpoint working

### Phase 5 Async Processing
- [ ] Redis configured
- [ ] Celery setup
- [ ] Event processing async
- [ ] Notification queuing
- [ ] Retry logic working

### Phase 6 Dashboard
- [ ] Summary endpoint working
- [ ] Metrics calculating correctly
- [ ] List views with filters
- [ ] Performance optimized
- [ ] Tests passing

---

## Success Metrics by Phase

| Phase | Metric | Target |
|-------|--------|--------|
| 1 | API Response Time | <300ms |
| 2 | Test Coverage | >80% |
| 2 | RBAC Enforcement | 100% |
| 3 | Event Capture | 100% |
| 4 | Workflow Rule Accuracy | 100% |
| 5 | Async Processing | <100ms publishing lag |
| 6 | Dashboard Load Time | <500ms |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Database performance | Proper indexing, query optimization, monitoring |
| JWT token expiration | Refresh token implementation, token management |
| Async job failures | Retry logic, dead-letter queue, alerts |
| Multi-tenant data leaks | Proper filtering, tests, audit logging |
| Workflow rule complexity | Start simple, JSON schema validation, tests |

---

## Timeline Summary

```
Week 1-2:  Foundation
Week 3-4:  Core CRM
Week 5:    Event System
Week 6-7:  Workflow Engine
Week 8:    Async Processing
Week 9:    Dashboard & Metrics
─────────────────────────
Total: 9 weeks to production-ready MVP
```

---

## Next Steps

1. Start with **Phase 1** immediately
2. Follow the exact implementation order
3. Write tests as you code
4. Commit regularly with clear messages
5. Document as you go
6. Review architecture before major changes

**Good luck. You've got this.**

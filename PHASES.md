# BiznizFlowPilot – Phase Breakdown

Quick reference for each implementation phase.

---

## Phase 1: Foundation (Week 1-2)

**Focus:** Infrastructure & Authentication

**Key Deliverables:**
- ✅ FastAPI project initialized
- ✅ PostgreSQL database configured
- ✅ JWT authentication working
- ✅ Multi-tenant support in place
- ✅ Error handling & logging

**Key Files:**
- `app/main.py`
- `app/core/config.py`
- `app/core/security.py`
- `app/models/base.py`
- `app/models/business.py`
- `app/models/user.py`
- `app/schemas/auth.py`
- `app/repositories/user.py`
- `app/services/auth.py`
- `app/api/auth.py`

**Success Criteria:**
- Register & login working
- JWT tokens generated and validated
- All queries filter by `business_id`
- >80 tests passing

**Test Command:**
```bash
pytest tests/ -v
```

---

## Phase 2: Core CRM (Week 3-4)

**Focus:** Lead & Task Management with RBAC

**Key Deliverables:**
- ✅ Customer CRUD
- ✅ Lead pipeline (New → Contacted → Qualified → Won/Lost)
- ✅ Task management with assignment
- ✅ Role-based access control
- ✅ Activity logging

**Key Models:**
```
Customer
Lead
Task
ActivityLog
```

**Key Services:**
```
LeadService
TaskService
CustomerService
```

**Key Endpoints:**
```
POST   /api/v1/customers
GET    /api/v1/customers
GET    /api/v1/leads
PATCH  /api/v1/leads/{id}
POST   /api/v1/tasks
PATCH  /api/v1/tasks/{id}
```

**RBAC Rules:**
- **Owner**: Full access
- **Manager**: Assign tasks, view reports
- **Staff**: View own tasks, update status

**Success Criteria:**
- RBAC enforced at service level
- All CRUD operations working
- Lead pipeline state machine working
- Task assignment working
- >80% test coverage

**Test Command:**
```bash
pytest tests/test_leads.py tests/test_tasks.py -v
```

---

## Phase 3: Event System (Week 5)

**Focus:** Event Publishing & Storage

**Key Deliverables:**
- ✅ Event model
- ✅ Event publishing (EventService)
- ✅ Event persistence in database
- ✅ Event querying

**Key Events:**
```
lead.created
lead.status_changed
task.created
task.completed
```

**Key Code:**
```python
# Publish event when lead is created
event_service.publish_event(
    event_type="lead.created",
    entity_type="lead",
    entity_id=lead.id,
    data=lead.to_dict()
)
```

**Success Criteria:**
- Events created on entity changes
- Events stored in database
- Can query events by type
- Event data is complete

---

## Phase 4: Workflow Engine (Week 6-7)

**Focus:** Automation Rules & Execution

**Key Deliverables:**
- ✅ Workflow model (trigger, conditions, actions)
- ✅ Rule evaluation engine
- ✅ Action executor
- ✅ Workflow run tracking
- ✅ Test endpoint

**Sample Workflows:**
```
1. New lead → Assign manager + Create task
2. Lead idle 3+ days → Create follow-up task
3. Task overdue → Notify manager
```

**Workflow Structure:**
```json
{
  "trigger_event": "lead.created",
  "conditions": [{"field": "lead.source", "operator": "==", "value": "web"}],
  "actions": [
    {"type": "assign_lead", "params": {"to_role": "manager"}},
    {"type": "create_task", "params": {"title": "Follow-up", "due_in_hours": 24}}
  ]
}
```

**Success Criteria:**
- Rule evaluation engine working
- Actions executing correctly
- Workflow run history tracked
- Test endpoint working

---

## Phase 5: Async Processing (Week 8)

**Focus:** Background Jobs & Queue Processing

**Key Deliverables:**
- ✅ Redis configured
- ✅ Celery setup
- ✅ Event → Workflow async processing
- ✅ Async notifications
- ✅ Retry logic

**Async Tasks:**
```
process_workflow_event()
send_notification()
check_overdue_tasks()
```

**Implementation:**
```python
@celery.task(bind=True, max_retries=3)
def process_workflow_event(self, event_id):
    try:
        # Process event through workflows
        pass
    except Exception as exc:
        self.retry(exc=exc, countdown=60)
```

**Success Criteria:**
- Events processed asynchronously
- <100ms event publishing latency
- Failed tasks retried automatically
- No blocking in API

---

## Phase 6: Dashboard & Metrics (Week 9)

**Focus:** Operational Visibility

**Key Deliverables:**
- ✅ Summary endpoint
- ✅ Lead metrics (total, by status, conversion rate)
- ✅ Task metrics (completion rate, overdue)
- ✅ Team performance metrics
- ✅ Workflow activity log

**Dashboard Metrics:**
```json
{
  "leads": {
    "total": 42,
    "by_status": {"new": 10, "contacted": 15, "qualified": 12, "won": 3},
    "conversion_rate": 7.1
  },
  "tasks": {
    "total": 156,
    "overdue": 3,
    "completion_rate": 50.6
  },
  "team": [{"user": "John", "leads": 15, "tasks_completed": 24}]
}
```

**Endpoint:**
```
GET /api/v1/dashboard/summary
```

**Success Criteria:**
- Dashboard loads <500ms
- Metrics calculate correctly
- Caching implemented
- All tests passing

---

## Quick Reference: What's Built When

| Feature | Phase | Status |
|---------|-------|--------|
| API Foundation | 1 | Foundation |
| JWT Auth | 1 | Foundation |
| Multi-tenant | 1 | Foundation |
| Customers | 2 | Core CRM |
| Leads | 2 | Core CRM |
| Tasks | 2 | Core CRM |
| RBAC | 2 | Core CRM |
| Events | 3 | Event System |
| Workflows | 4 | Automation |
| Redis/Celery | 5 | Async |
| Dashboard | 6 | Metrics |

---

## Development Checklist Template

```markdown
### Phase X: [Name]

- [ ] Database models created
- [ ] Migrations written
- [ ] Services implemented
- [ ] API routes working
- [ ] Unit tests written
- [ ] Integration tests passing
- [ ] Error handling done
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Deployed to staging
```

---

## Commands by Phase

### Phase 1
```bash
uvicorn app.main:app --reload
pytest tests/test_auth.py -v
```

### Phase 2
```bash
pytest tests/test_leads.py tests/test_tasks.py -v
```

### Phase 3
```bash
pytest tests/test_events.py -v
```

### Phase 4
```bash
pytest tests/test_workflows.py -v
# Test workflow rules
curl -X POST http://localhost:8000/api/v1/workflows/1/test
```

### Phase 5
```bash
celery -A app.workers.celery_app worker --loglevel=info
redis-server
pytest tests/test_async.py -v
```

### Phase 6
```bash
curl http://localhost:8000/api/v1/dashboard/summary
pytest tests/test_dashboard.py -v
```

---

## Success Metrics by Phase

| Phase | Metric | Target |
|-------|--------|--------|
| 1 | Test Pass Rate | 100% |
| 2 | RBAC Enforcement | 100% |
| 3 | Event Capture | 100% |
| 4 | Workflow Accuracy | 100% |
| 5 | Async Latency | <100ms |
| 6 | Dashboard Load Time | <500ms |

---

## Links

- [Full PRD](PRD.md)
- [Architecture](ARCHITECTURE.md)
- [Implementation Plan](IMPLEMENTATION_PLAN.md)
- [Getting Started](GETTING_STARTED.md)

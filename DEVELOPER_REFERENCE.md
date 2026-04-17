# Phase 1: Developer Quick Reference

## The Core Pattern (Use This for Everything)

### 1. Create Model
```python
# app/models/my_entity.py
from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel

class MyEntity(BaseModel):
    __tablename__ = "my_entities"
    
    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,  # CRITICAL: For efficient queries
    )
    
    name = Column(String(255), nullable=False)
    # ... other fields
```

**Golden Rule**: Every model has `business_id` as FK to `businesses`

---

### 2. Create Schemas (Validation)
```python
# app/schemas/my_entity.py
from uuid import UUID
from pydantic import BaseModel, Field

class MyEntityCreate(BaseModel):
    name: str = Field(..., min_length=1)
    # ... other fields

class MyEntityResponse(BaseModel):
    id: UUID
    business_id: UUID
    name: str
    
    class Config:
        from_attributes = True
```

---

### 3. Create Repository (Data Access)
```python
# app/repositories/my_entity.py
from sqlalchemy.orm import Session
from app.models.my_entity import MyEntity
from app.repositories.base import BaseRepository

class MyEntityRepository(BaseRepository[MyEntity]):
    def __init__(self, db: Session):
        super().__init__(db, MyEntity)
    
    # Add custom queries here (always filter by business_id)
    def get_by_name(self, business_id: UUID, name: str):
        return self.db.query(MyEntity).filter(
            MyEntity.business_id == business_id,  # 🧨 ALWAYS
            MyEntity.name == name,
        ).first()
```

**Golden Rule**: Every query must have `Model.business_id == business_id` filter

---

### 4. Create Service (Business Logic)
```python
# app/services/my_entity.py
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.my_entity import MyEntity
from app.repositories.my_entity import MyEntityRepository
from app.schemas.my_entity import MyEntityCreate, MyEntityResponse

class MyEntityService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = MyEntityRepository(db)
    
    def create(
        self,
        business_id: UUID,
        data: MyEntityCreate,
    ) -> MyEntityResponse:
        entity = self.repo.create(business_id=business_id, **data.dict())
        return MyEntityResponse.from_orm(entity)
    
    def get(self, business_id: UUID, entity_id: UUID) -> MyEntityResponse:
        entity = self.repo.get(business_id, entity_id)
        if not entity:
            raise ValueError("Not found")
        return MyEntityResponse.from_orm(entity)
    
    def list(self, business_id: UUID, skip: int = 0, limit: int = 20):
        entities = self.repo.list(business_id, skip, limit)
        return [MyEntityResponse.from_orm(e) for e in entities]
```

**Golden Rule**: Always receive `business_id` parameter (never use from request)

---

### 5. Create API Routes
```python
# app/api/my_entity.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.auth import CurrentUser
from app.schemas.my_entity import MyEntityCreate, MyEntityResponse
from app.services.my_entity import MyEntityService
from app.main import get_current_user

router = APIRouter(prefix="/my-entities", tags=["my-entity"])

@router.post("", response_model=MyEntityResponse)
def create_my_entity(
    data: MyEntityCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_database),
):
    service = MyEntityService(db)
    return service.create(current_user.business_id, data)

@router.get("/{entity_id}", response_model=MyEntityResponse)
def get_my_entity(
    entity_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = MyEntityService(db)
    try:
        return service.get(current_user.business_id, entity_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found")
```

**Golden Rule**: Always pass `current_user.business_id` to services (never use current_user.user_id alone)

---

### 6. Create Tests
```python
# tests/test_my_entity.py
import pytest

class TestMyEntity:
    def test_create_my_entity(self, client, registered_user):
        token = registered_user["access_token"]
        
        response = client.post(
            "/api/v1/my-entities",
            json={"name": "Test Entity"},
            headers={"Authorization": f"Bearer {token}"},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Entity"
        assert "id" in data
    
    def test_get_my_entity(self, client, registered_user):
        # ... similar pattern
        pass
```

---

## Multi-Tenancy Enforcement Checklist

For EVERY model, EVERY method:

- [ ] Model has `business_id` FK to `businesses`
- [ ] Repository method receives `business_id` parameter
- [ ] Repository filters by `business_id` in every query
- [ ] Service passes `business_id` from `current_user`
- [ ] API route has `Depends(get_current_user)`
- [ ] Routes pass `current_user.business_id` to services
- [ ] Tests verify data isolation (different users don't see each other's data)

---

## Common Patterns

### Pattern: Filtering by Status
```python
def list_by_status(self, business_id: UUID, status: str):
    return self.db.query(Lead).filter(
        Lead.business_id == business_id,  # 🧨 FIRST
        Lead.status == status,            # Then other filters
    ).all()
```

### Pattern: Checking Ownership Before Updates
```python
def update(self, business_id: UUID, entity_id: UUID, **kwargs):
    entity = self.get(business_id, entity_id)  # Checks ownership
    if not entity:
        return None
    for k, v in kwargs.items():
        setattr(entity, k, v)
    self.db.commit()
    self.db.refresh(entity)
    return entity
```

### Pattern: Protecting Related Data
```python
# When Lead references Customer
def create_lead(self, business_id: UUID, customer_id: UUID, **kwargs):
    # Ensure customer belongs to this business
    customer = self.customer_repo.get(business_id, customer_id)
    if not customer:
        raise ValueError("Customer not found in your business")
    
    # Now safe to create lead with this customer
    return self.repo.create(business_id=business_id, customer_id=customer_id, **kwargs)
```

---

## What NOT to Do

### ❌ Don't: Query without business_id
```python
def get_all_leads(db):
    return db.query(Lead).all()  # NO!
```

### ❌ Don't: Let user supply business_id
```python
def list_leads(current_user, business_id):  # NO!
    return repo.list(business_id)  # What if they change it in URL?
```

### ❌ Don't: Query across business_ids
```python
def get_reports(db):
    return db.query(Lead).group_by(Lead.status).all()  # NO! Across companies
```

### ❌ Don't: Skip repository layer
```python
def list_leads(current_user):
    return db.query(Lead).all()  # NO! Bypass repository
```

### ❌ Don't: Use raw SQL
```python
db.execute("SELECT * FROM leads")  # NO! Can't filter by business_id
```

---

## Database Indexing Strategy

Add indexes for:
1. **Foreign keys** (automatic with SQLAlchemy)
2. **Frequently filtered columns** (business_id, status, assigned_to)
3. **Frequently sorted columns** (created_at, due_date)

Example:
```python
class Lead(BaseModel):
    __tablename__ = "leads"
    
    business_id = Column(..., index=True)  # ✅ Index this
    status = Column(String, index=True)    # ✅ Index this
    assigned_to = Column(..., index=True)  # ✅ Index this
    created_at = Column(..., index=True)   # For sorting
```

---

## Testing Strategy

### Use In-Memory DB (Fast)
```python
# conftest.py already does this
def test_db():
    engine = create_engine("sqlite:///:memory:")
    # ...creates in-memory database
```

### Test Multi-Tenancy Isolation
```python
def test_user_cannot_see_other_business_data(client):
    # Register business 1
    user1 = register_user("user1@company1.com")
    business1_id = extract_business_id(user1)
    
    # Create lead for business 1
    client.post(
        "/api/v1/leads",
        json={...},
        headers=auth_header(user1),
    )
    
    # Register business 2
    user2 = register_user("user2@company2.com")
    
    # User 2 should NOT see business 1's leads
    response = client.get(
        "/api/v1/leads",
        headers=auth_header(user2),
    )
    
    assert len(response.json()) == 0  # Empty!
```

---

## Performance Tips

### 1. Use Pagination
```python
def list(self, business_id: UUID, skip: int = 0, limit: int = 20):
    return self.db.query(...).offset(skip).limit(limit).all()
```

### 2. Use Eager Loading for Relationships
```python
from sqlalchemy.orm import joinedload

def get_with_customer(self, business_id: UUID, lead_id: UUID):
    return self.db.query(Lead).options(
        joinedload(Lead.customer)
    ).filter(...).first()
```

### 3. Filter Before Count
```python
# ❌ Inefficient
count = len(self.list(business_id))

# ✅ Efficient
count = self.count(business_id)
```

### 4. Use Database Constraints
```python
# Let database enforce uniqueness
class Customer(BaseModel):
    email = Column(String, unique=True, index=True)
```

---

## Debugging Checklist

If data is leaking:
- [ ] Model has `business_id` FK?
- [ ] Repository filters include `Model.business_id == business_id`?
- [ ] Service receives `business_id` parameter?
- [ ] API route passes `current_user.business_id`?

If tests are flaky:
- [ ] Using same in-memory database for all tests?
- [ ] Cleaning up between tests?
- [ ] Not sharing state between test instances?

If route is 404:
- [ ] Did you add route to `app.include_router()`?
- [ ] Is prefix correct (/api/v1)?
- [ ] Are parameter names correct?

---

## The One Rule

> **Every query must filter by business_id. No exceptions.**

If you're about to write:
```python
self.db.query(Something).filter(...)
```

Ask: "Is `Something.business_id == business_id` in the filter?"

If not: Add it.

---

## Remember

This isn't just code style. It's security architecture.

A forgotten business_id filter = data leaking between companies.

This is why every repository method has it.
This is why every test checks it.
This is why 🧨 comments mark every occurrence.

You're not just coding. You're protecting customer data.

Act like it.


# Phase 1: Architecture Diagram

## Request/Response Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser/API)                           │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 │ 1. POST /api/v1/auth/register
                 │    { business_name, email, password, ... }
                 │
┌────────────────▼────────────────────────────────────────────────────┐
│                    FASTAPI APP LAYER                                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ api/auth.py                                                  │  │
│  │  - POST /register                                            │  │
│  │  - POST /login                                               │  │
│  │  - Input validation (Pydantic)                               │  │
│  └──────────────┬───────────────────────────────────────────────┘  │
│                 │                                                    │
│  ┌──────────────▼───────────────────────────────────────────────┐  │
│  │ main.py                                                      │  │
│  │  - get_current_user(token) → CurrentUser                    │  │
│  │  - CORS middleware                                           │  │
│  │  - Error handling                                            │  │
│  └──────────────┬───────────────────────────────────────────────┘  │
└────────────────┼────────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────────┐
│              BUSINESS LOGIC LAYER (Services)                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ services/auth.py                                             │  │
│  │  - register(business_name, email, password, ...)             │  │
│  │    • Hash password (bcrypt)                                  │  │
│  │    • Create Business (tenant)                                │  │
│  │    • Create User (owner role)                                │  │
│  │    • Return JWT tokens                                       │  │
│  │                                                               │  │
│  │  - login(email, password)                                    │  │
│  │    • Verify password                                         │  │
│  │    • Generate tokens                                         │  │
│  └──────────────┬───────────────────────────────────────────────┘  │
└────────────────┼────────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────────┐
│           DATA ACCESS LAYER (Repositories)                          │
│           🧨 CRITICAL MULTI-TENANCY ENFORCEMENT                    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ repositories/base.py (BaseRepository)                         │  │
│  │  - create(business_id, **kwargs)                              │  │
│  │  - get(business_id, id) ← Filters by business_id             │  │
│  │  - list(business_id) ← Filters by business_id                │  │
│  │  - update(business_id, id, **kwargs)                          │  │
│  │  - delete(business_id, id)                                    │  │
│  │                                                               │  │
│  │ repositories/user.py (UserRepository)                         │  │
│  │  - get_by_email(business_id, email)                           │  │
│  │  - list_by_role(business_id, role)                            │  │
│  │                                                               │  │
│  │ repositories/business.py (BusinessRepository)                 │  │
│  │  - get_by_email(email)                                        │  │
│  │  - get_by_id(id)                                              │  │
│  └──────────────┬───────────────────────────────────────────────┘  │
└────────────────┼────────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────────┐
│                   DATABASE LAYER                                    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ PostgreSQL                                                   │  │
│  │                                                               │  │
│  │  businesses                   users                           │  │
│  │  ├─ id (UUID, PK)             ├─ id (UUID, PK)              │  │
│  │  ├─ name                       ├─ business_id (FK) ← CRITICAL│  │
│  │  ├─ email (UNIQUE)             ├─ email (INDEX)             │  │
│  │  ├─ phone                      ├─ first_name                │  │
│  │  ├─ created_at                 ├─ last_name                 │  │
│  │  └─ updated_at                 ├─ hashed_password           │  │
│  │                                ├─ role (owner|manager|staff)│  │
│  │                                ├─ is_active                 │  │
│  │                                ├─ created_at                │  │
│  │                                └─ updated_at                │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenancy Enforcement Pattern

```
🧨 CRITICAL: Every Data Query

┌─────────────────────────────────────┐
│  Request with JWT Token             │
│  Authorization: Bearer eyJ...        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  get_current_user(request)          │
│  - Extract Bearer token             │
│  - Decode JWT                       │
│  - Return CurrentUser:              │
│    {                                │
│      user_id: uuid,                 │
│      business_id: uuid ← KEY!       │
│      email: str,                    │
│      role: str                      │
│    }                                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Route Handler                      │
│  (Receives CurrentUser via Depends) │
│  current_user.business_id           │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Service Layer                      │
│  self.user_repo.list(               │
│    business_id=current_user.        │
│      business_id                    │
│  )                                  │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Repository (BaseRepository)        │
│  CRITICAL CODE:                     │
│                                     │
│  return self.db.query(User).filter( │
│    User.business_id == business_id, │
│    # ↑ ENFORCEMENT                  │
│    User.is_active == True           │
│  ).all()                            │
│                                     │
│  ✅ Safe - Filtered by business_id  │
│  ❌ Unsafe - No business_id filter  │
└─────────────────────────────────────┘
```

---

## Authentication Flow Details

### Register (Creates Business + Owner)

```
POST /api/v1/auth/register
{
  "business_name": "Acme Corp",
  "email": "john@acme.com",
  "password": "secure_pwd",
  "first_name": "John",
  "last_name": "Doe"
}
   ▼
AuthService.register()
   │
   ├─ Check email not used
   │  └─ query User where email = "john@acme.com"
   │
   ├─ Check business email not used
   │  └─ query Business where email = "john@acme.com"
   │
   ├─ Create Business
   │  └─ INSERT INTO businesses (name, email, phone) ...
   │     🔑 Gets business_id
   │
   ├─ Hash Password
   │  └─ bcrypt.hashpw(password) → $2b$12$...
   │
   ├─ Create User (Owner)
   │  └─ INSERT INTO users (
   │       business_id=<UUID>,  ← CRITICAL
   │       email,
   │       hashed_password,
   │       role="owner",
   │       is_active=true
   │     )
   │
   └─ Generate Tokens
      ├─ access_token = JWT({
      │    sub: user_id,
      │    user_id: user_id,
      │    business_id: business_id,  ← CRITICAL
      │    email: "john@acme.com"
      │  })
      │
      └─ refresh_token = JWT({...})

Response:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

### Login (Authenticate + Return JWT)

```
POST /api/v1/auth/login
{
  "email": "john@acme.com",
  "password": "secure_pwd"
}
   ▼
AuthService.login()
   │
   ├─ Find User
   │  └─ user = query User where email = "john@acme.com"
   │
   ├─ Verify Password
   │  └─ bcrypt.checkpw(password, user.hashed_password)
   │     ✅ True or ❌ False
   │
   ├─ Check User Active
   │  └─ if user.is_active == False: raise ValueError
   │
   └─ Generate Tokens (same as register)

Response:
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

### Access Protected Route

```
GET /api/v1/me
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
   ▼
FastAPI Dependency: get_current_user(request)
   │
   ├─ Extract token from Authorization header
   │
   ├─ Decode token
   │  └─ JWT.decode(token, SECRET_KEY)
   │     Returns: {
   │       "sub": user_id,
   │       "user_id": user_id,
   │       "business_id": business_id,
   │       "email": "john@acme.com",
   │       "exp": 1234567890
   │     }
   │
   └─ Return CurrentUser
      {
        "user_id": uuid,
        "business_id": uuid,
        "email": "john@acme.com",
        "role": "owner",
        "full_name": "John Doe"
      }

Route Handler:
def get_current_user_info(
    current_user: CurrentUser = Depends(get_current_user)
) -> dict:
    return {
      "user_id": current_user.user_id,
      "business_id": current_user.business_id,
      "email": current_user.email,
      "role": current_user.role,
      "full_name": current_user.full_name
    }
```

---

## Layer Responsibilities

### API Layer (`app/api/`)
- **What**: HTTP request/response handling
- **Validates**: Input (Pydantic schemas)
- **Returns**: JSON responses
- **Raises**: HTTPException on errors

### Services Layer (`app/services/`)
- **What**: Business logic orchestration
- **Uses**: Repositories to access data
- **Handles**: Complex workflows
- **Returns**: Domain objects, not ORM models

### Repositories Layer (`app/repositories/`)
- **What**: Data access abstraction
- **Uses**: SQLAlchemy ORM
- **Enforces**: Multi-tenancy (business_id filtering)
- **Returns**: ORM model instances

### Models Layer (`app/models/`)
- **What**: Database schema definitions
- **Defines**: Tables, columns, relationships
- **Enforces**: Constraints (FK, unique, etc.)
- **Provides**: SQLAlchemy ORM classes

### Core Layer (`app/core/`)
- **What**: Application configuration and utilities
- **Contains**: Database connections, JWT, password hashing
- **Singleton**: Single instance for whole app

---

## Security Guarantees

### 1. Password Security
- ✅ Bcrypt with salt (rounds=12)
- ✅ Never stored in plain text
- ❌ Never hashed client-side (easy to reverse engineer)

### 2. Token Security
- ✅ JWT signed with SECRET_KEY
- ✅ Expiration time (24 hours default)
- ✅ Contains minimal sensitive info only
- ❌ Never exposed in URL (Bearer header only)

### 3. Multi-Tenancy Security
- ✅ Every query has business_id filter
- ✅ business_id in JWT so client can't change it
- ✅ Repositories enforce filtering (can't be bypassed)
- ❌ No raw SQL (ORM prevents injection)

### 4. Request Authentication
- ✅ Dependency injection forces JWT validation
- ✅ Invalid tokens rejected immediately
- ✅ business_id tied to user_id
- ❌ No user spoofing possible (token is signed)

---

## What Phase 1 Guarantees

✅ **Authentication Works**
- Register creates business + owner
- Login returns valid JWT
- Tokens are properly signed/validated

✅ **Multi-Tenancy Works**
- All queries filter by business_id
- Users can only see their business data
- No cross-company data leaks

✅ **Security Works**
- Passwords hashed (not stored plain)
- Tokens signed (can't be forged)
- JWT contains business_id (can't be changed)

✅ **Scalability Ready**
- Session pooling (not n+1 connections)
- Async-ready (FastAPI Depends pattern)
- Alembic for schema versioning

✅ **Testability**
- Unit tests for auth flows
- Integration tests for endpoints
- In-memory DB for testing (fast)

---

## What Phase 1 Does NOT Do

❌ CRUD for Customers, Leads, Tasks (Phase 2)
❌ Event system (Phase 3)
❌ Workflows (Phase 4)
❌ Async jobs (Phase 5)
❌ Dashboard (Phase 6)

This is intentional. Phase 1 is the foundation. Everything else depends on this being solid.


# Getting Started with BiznizFlowPilot

---

## Prerequisites

- Python 3.10+
- PostgreSQL 13+
- Redis (for async processing)
- Git

---

## Local Development Setup

### 1. Clone & Setup Virtual Environment

```bash
# Clone the repository
git clone <repo-url>
cd BiznizFlowPilot

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Setup Database

```bash
# Create PostgreSQL database
createdb biznizflowpilot_db

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL=postgresql://username:password@localhost:5432/biznizflowpilot_db
```

### 4. Run Migrations

```bash
# Create initial migration
alembic revision --autogenerate -m "Initial migration"

# Apply migrations
alembic upgrade head
```

### 5. Run Development Server

```bash
# Start FastAPI server (starts on http://localhost:8000)
uvicorn app.main:app --reload

# In another terminal, start Redis
redis-server

# In another terminal, start Celery worker
celery -A app.workers.celery_app worker --loglevel=info
```

---

## API Testing

### Access API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Test Authentication

```bash
# Register a new user/business
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "My Company",
    "email": "owner@company.com",
    "password": "secure_password",
    "first_name": "John",
    "last_name": "Doe"
  }'

# Login
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@company.com",
    "password": "secure_password"
  }'

# Use the returned token in requests
curl -X GET "http://localhost:8000/api/v1/users" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Project Structure

```
app/
├── main.py                    # FastAPI entry point
├── core/
│   ├── config.py             # Config & settings
│   ├── security.py           # JWT & auth utilities
│   └── constants.py          # App constants
├── models/                    # SQLAlchemy models
│   ├── base.py               # Base model with UUID
│   ├── business.py
│   └── user.py
├── schemas/                   # Pydantic schemas (validation)
│   ├── auth.py
│   └── user.py
├── repositories/              # Data access layer
│   ├── base.py
│   └── user.py
├── services/                  # Business logic
│   ├── auth.py
│   └── user.py
├── api/                       # API routes
│   ├── auth.py
│   └── users.py
├── workers/                   # Async tasks (Celery)
│   └── celery_app.py
└── utils/
    └── logger.py             # Logging setup

migrations/                     # Alembic migrations
tests/                         # Test suite
```

---

## Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_auth.py

# Run tests matching pattern
pytest -k "test_login"
```

---

## Development Workflow

### 1. Feature Branch

```bash
git checkout -b feature/add-customers
```

### 2. Make Changes

- Write code
- Write tests
- Ensure code is formatted

```bash
# Format code
black app/

# Sort imports
isort app/

# Check code quality
flake8 app/

# Type checking
mypy app/
```

### 3. Run Tests

```bash
pytest
```

### 4. Commit & Push

```bash
git add .
git commit -m "Add customer management"
git push origin feature/add-customers
```

### 5. Create Pull Request

---

## Database Tasks

### Create New Model

1. Create model in `app/models/`
2. Add mapper in `app/models/__init__.py`
3. Create migration:
   ```bash
   alembic revision --autogenerate -m "Add customer table"
   ```
4. Run migration:
   ```bash
   alembic upgrade head
   ```

### Rollback Migration

```bash
# Rollback one version
alembic downgrade -1

# Rollback to specific version
alembic downgrade <revision_id>
```

---

## Debugging

### Enable SQL Logging

In `.env`, set:
```
SQLALCHEMY_ECHO=True
```

### Debug API Request

```bash
# Check request/response
curl -v http://localhost:8000/api/v1/users
```

### Debug Celery Tasks

```bash
# Start Celery worker with debug logging
celery -A app.workers.celery_app worker --loglevel=debug
```

---

## Deployment Preparation

### 1. Collect Static Files

```bash
# (If applicable for frontend)
python manage.py collectstatic
```

### 2. Run Migrations

```bash
alembic upgrade head
```

### 3. Start Production Server

```bash
gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker
```

### 4. Start Celery Worker

```bash
celery -A app.workers.celery_app worker --loglevel=info --concurrency=4
```

---

## Troubleshooting

### Database Connection Error

```
Error: could not translate host name "localhost" to address
```

**Solution:** Ensure PostgreSQL is running
```bash
# macOS
brew services start postgresql

# Ubuntu
sudo systemctl start postgresql

# Windows
# Start PostgreSQL service from services.msc
```

### Redis Connection Error

```
Error: ConnectionRefusedError: [Errno 111] Connection refused
```

**Solution:** Start Redis
```bash
# macOS
brew services start redis

# Ubuntu
sudo systemctl start redis-server

# Windows
redis-server.exe
```

### Migration Conflict

```
error: Target database is not up to date with head
```

**Solution:** Check current state and resolve conflicts
```bash
alembic current
alembic history

# Or reset for development
alembic downgrade base
alembic upgrade head
```

---

## IDE Setup

### VS Code Extensions

- Python (ms-python.python)
- Pylance (ms-python.vscode-pylance)
- SQLTools (mtxr.sqltools)
- FastAPI/Starlette snippets

### PyCharm

- Built-in Python support
- Database tool integration
- FastAPI plugin

---

## Next Steps

1. Complete **Phase 1** items
2. Write tests as you build
3. Follow the implementation plan
4. Commit regularly
5. Document as you go

---

## References

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Celery Documentation](https://docs.celeryproject.org/)
- [JWT Documentation](https://jwt.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## Questions?

Refer back to:
- [PRD.md](PRD.md) - Product requirements
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) - Implementation phases


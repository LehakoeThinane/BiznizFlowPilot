"""Main FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth,
    customers,
    events,
    inventory,
    leads,
    metrics,
    products,
    purchase_orders,
    sales_orders,
    suppliers,
    tasks,
    users,
    workflow_definitions,
    workflows,
)
from app.core.config import settings
from app.core.exception_handlers import unhandled_exception_handler
from app.dependencies import get_current_user
from app.schemas.auth import CurrentUser
from app.utils.logger import get_logger

logger = get_logger(__name__)

# ============================================================================
# Initialize FastAPI App
# ============================================================================


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Application lifespan hooks."""
    logger.info("Starting %s v%s", settings.app_name, settings.version)
    logger.info("Environment: %s", settings.environment)
    logger.info("Debug mode: %s", settings.debug)
    yield
    logger.info("Shutting down %s", settings.app_name)

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    debug=settings.debug,
    lifespan=lifespan,
)
app.add_exception_handler(Exception, unhandled_exception_handler)

# ============================================================================
# CORS Middleware
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Routes
# ============================================================================

# Health check (no auth required)
@app.get("/health")
def health_check() -> dict:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.version,
        "environment": settings.environment,
    }


# Auth routes (no auth required)
app.include_router(auth.router, prefix=settings.api_v1_prefix)

# CRM routes (auth required)
app.include_router(customers.router)
app.include_router(events.router)
app.include_router(leads.router)
app.include_router(tasks.router)
app.include_router(users.router)

# Automation routes (auth required)
app.include_router(workflows.router)
app.include_router(workflow_definitions.router)
app.include_router(metrics.router)

# ERP routes (auth required)
app.include_router(products.router)
app.include_router(suppliers.router)
app.include_router(inventory.router)
app.include_router(sales_orders.router)
app.include_router(purchase_orders.router)


# ============================================================================
# Protected Example Route (Requires auth)
# ============================================================================


def _serialize_current_user(current_user: CurrentUser) -> dict:
    """Normalize authenticated user response payload."""
    return {
        "user_id": current_user.user_id,
        "business_id": current_user.business_id,
        "email": current_user.email,
        "role": current_user.role,
        "full_name": current_user.full_name,
    }


@app.get(f"{settings.api_v1_prefix}/me")
def get_current_user_info(current_user: CurrentUser = Depends(get_current_user)) -> dict:
    """Get current authenticated user information.
    
    Protected route - requires valid JWT token.
    """
    return _serialize_current_user(current_user)


@app.get(f"{settings.api_v1_prefix}/users/me")
def get_current_user_info_compat(current_user: CurrentUser = Depends(get_current_user)) -> dict:
    """Compatibility alias for deployments using /api/v1/users/me."""
    return _serialize_current_user(current_user)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )

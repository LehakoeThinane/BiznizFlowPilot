"""Authentication service - business logic for auth."""

from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.business import Business
from app.models.user import User
from app.repositories.business import BusinessRepository
from app.repositories.user import UserRepository
from app.schemas.auth import TokenResponse


class AuthService:
    """Authentication service."""

    def __init__(self, db: Session):
        """Initialize with database session."""
        self.db = db
        self.user_repo = UserRepository(db)
        self.business_repo = BusinessRepository(db)

    def register(
        self,
        business_name: str,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
    ) -> TokenResponse:
        """Register new business and owner.
        
        Creates:
        1. Business (tenant)
        2. User (owner with full access)
        3. Returns tokens
        
        Args:
            business_name: Business name
            email: Owner email (also used as business email)
            password: Owner password
            first_name: Owner first name
            last_name: Owner last name
            
        Returns:
            TokenResponse with access and refresh tokens
            
        Raises:
            ValueError: If email already exists
        """
        # Check if business already exists
        existing_business = self.business_repo.get_by_email(email)
        if existing_business:
            raise ValueError(f"Business with email '{email}' already exists")

        # Check if user already exists (across all businesses)
        existing_user = self.user_repo.get_by_email_all(email)
        if existing_user:
            raise ValueError(f"User with email '{email}' already exists")

        try:
            # Create business
            business = Business(
                name=business_name,
                email=email,
            )
            self.db.add(business)
            self.db.flush()  # Get business.id without committing

            # Create owner user
            hashed_pwd = hash_password(password)
            user = User(
                business_id=business.id,
                email=email,
                first_name=first_name,
                last_name=last_name,
                hashed_password=hashed_pwd,
                role="owner",
                is_active=True,
            )
            self.db.add(user)
            self.db.commit()

            # Generate tokens
            return self._create_tokens(user_id=user.id, business_id=business.id, email=email)

        except Exception as e:
            self.db.rollback()
            raise e

    def login(self, email: str, password: str) -> TokenResponse:
        """Login user and return tokens.
        
        Args:
            email: User email
            password: User password
            
        Returns:
            TokenResponse with access and refresh tokens
            
        Raises:
            ValueError: If credentials invalid
        """
        # Get user
        user = self.user_repo.get_by_email_all(email)
        if not user:
            raise ValueError("Invalid email or password")

        # Verify password
        if not verify_password(password, user.hashed_password):
            raise ValueError("Invalid email or password")

        # Check user is active
        if not user.is_active:
            raise ValueError("User account is inactive")

        # Generate tokens
        return self._create_tokens(
            user_id=user.id,
            business_id=user.business_id,
            email=user.email,
        )

    def validate_user(
        self,
        user_id: UUID,
        business_id: UUID,
    ) -> Optional[User]:
        """Validate user exists and is active.
        
        🧨 CRITICAL: Used to extract user from JWT token
        Ensures user still exists and is in the business
        
        Args:
            user_id: User ID
            business_id: Business ID
            
        Returns:
            User if valid, None otherwise
        """
        user = self.user_repo.get(business_id, user_id)
        
        if not user or not user.is_active:
            return None
            
        return user

    @staticmethod
    def _create_tokens(
        user_id: UUID,
        business_id: UUID,
        email: str,
    ) -> TokenResponse:
        """Create access and refresh tokens.
        
        Args:
            user_id: User ID
            business_id: Business ID
            email: User email
            
        Returns:
            TokenResponse
        """
        # Token payload
        token_data = {
            "sub": str(user_id),
            "user_id": str(user_id),
            "business_id": str(business_id),
            "email": email,
        }

        # Create tokens
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=24 * 60 * 60,  # 24 hours in seconds
        )

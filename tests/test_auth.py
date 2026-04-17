"""Tests for authentication."""

import pytest


class TestRegistration:
    """Test user registration."""

    def test_register_success(self, client, sample_user_data):
        """Test successful registration."""
        response = client.post("/api/v1/auth/register", json=sample_user_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 24 * 60 * 60

    def test_register_duplicate_email(self, client, sample_user_data):
        """Test registration with duplicate email fails."""
        # Register first user
        response1 = client.post("/api/v1/auth/register", json=sample_user_data)
        assert response1.status_code == 200
        
        # Try to register with same email
        response2 = client.post("/api/v1/auth/register", json=sample_user_data)
        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"]

    def test_register_missing_required_fields(self, client):
        """Test registration with missing fields."""
        incomplete_data = {
            "business_name": "Test",
            "email": "test@example.com",
            # Missing other required fields
        }
        
        response = client.post("/api/v1/auth/register", json=incomplete_data)
        assert response.status_code == 422  # Validation error


class TestLogin:
    """Test user login."""

    def test_login_success(self, client, sample_user_data):
        """Test successful login."""
        # Register user
        client.post("/api/v1/auth/register", json=sample_user_data)
        
        # Login
        login_data = {
            "email": sample_user_data["email"],
            "password": sample_user_data["password"],
        }
        response = client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_login_invalid_password(self, client, sample_user_data):
        """Test login with wrong password."""
        # Register user
        client.post("/api/v1/auth/register", json=sample_user_data)
        
        # Try login with wrong password
        login_data = {
            "email": sample_user_data["email"],
            "password": "wrongpassword",
        }
        response = client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 401
        assert "Invalid email or password" in response.json()["detail"]

    def test_login_nonexistent_email(self, client):
        """Test login with non-existent email."""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "password123",
        }
        response = client.post("/api/v1/auth/login", json=login_data)
        
        assert response.status_code == 401
        assert "Invalid email or password" in response.json()["detail"]


class TestProtectedRoutes:
    """Test protected routes requiring authentication."""

    def test_get_current_user_with_token(self, client, registered_user):
        """Test accessing protected route with valid token."""
        access_token = registered_user["access_token"]
        
        headers = {"Authorization": f"Bearer {access_token}"}
        response = client.get("/api/v1/me", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "business_id" in data
        assert "email" in data

    def test_get_current_user_without_token(self, client):
        """Test accessing protected route without token."""
        response = client.get("/api/v1/me")
        
        assert response.status_code == 401
        assert "Missing or invalid authorization header" in response.json()["detail"]

    def test_get_current_user_invalid_token(self, client):
        """Test accessing protected route with invalid token."""
        headers = {"Authorization": "Bearer invalid.token.here"}
        response = client.get("/api/v1/me", headers=headers)
        
        assert response.status_code == 401
        assert "Invalid or expired token" in response.json()["detail"]


class TestHealthCheck:
    """Test health check endpoint."""

    def test_health_check(self, client):
        """Test health check (no auth required)."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data

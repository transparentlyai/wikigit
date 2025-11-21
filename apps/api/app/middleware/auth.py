"""
GCP Identity-Aware Proxy (IAP) authentication middleware and authorization helpers.

This module implements authentication and authorization for WikiGit using GCP IAP:

1. AuthMiddleware: Extracts user email from IAP headers and validates authentication
2. get_current_user(): FastAPI dependency to get the authenticated user
3. require_admin(): FastAPI dependency to enforce admin-only access

Requirements Implemented:
- REQ-AUTH-001: Extract user email from X-Goog-Authenticated-User-Email header
- REQ-AUTH-002: Deny access if authentication header is missing
- REQ-AUTH-003: Check user against app.admins list in configuration
- REQ-AUTH-004: Restrict admin-only routes using require_admin dependency
- REQ-AUTH-005: Return 401 for unauthorized, 403 for forbidden access

Development Mode:
- Set WIKIGIT_DEV_MODE=true environment variable to bypass IAP authentication
- In dev mode, uses WIKIGIT_DEV_USER email (defaults to first admin user)
"""

import logging
import os
from typing import Optional

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config.settings import settings

logger = logging.getLogger(__name__)

# Development mode configuration
DEV_MODE = os.getenv("WIKIGIT_DEV_MODE", "false").lower() == "true"
DEV_USER = os.getenv("WIKIGIT_DEV_USER", "")


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware to extract and validate user authentication from GCP IAP headers.

    This middleware:
    - Extracts user email from X-Goog-Authenticated-User-Email header
    - Parses the email from IAP format (accounts.google.com:user@example.com)
    - Stores the user email in request.state for downstream use
    - Skips authentication for health check endpoints
    - Returns 401 Unauthorized if authentication header is missing or invalid

    The middleware runs on every request and populates request.state.user_email
    for use by route dependencies like get_current_user() and require_admin().
    """

    # Endpoints that bypass authentication
    SKIP_AUTH_PATHS = {"/health", "/healthz", "/"}

    def __init__(self, app):
        """Initialize the authentication middleware."""
        super().__init__(app)
        if DEV_MODE:
            dev_user = DEV_USER or (settings.app.admins[0] if settings.app.admins else "dev@wikigit.local")
            logger.warning(f"DEVELOPMENT MODE ENABLED - Authentication bypassed, using user: {dev_user}")
        else:
            logger.info("AuthMiddleware initialized - IAP authentication required")

    async def dispatch(self, request: Request, call_next):
        """
        Process each request to extract and validate authentication.

        Args:
            request: The incoming HTTP request
            call_next: The next middleware or route handler

        Returns:
            Response from the next handler, or 401 error if authentication fails
        """
        # Skip authentication for specific endpoints
        if request.url.path in self.SKIP_AUTH_PATHS:
            return await call_next(request)

        # Development mode: bypass IAP authentication
        if DEV_MODE:
            dev_user = DEV_USER or (settings.app.admins[0] if settings.app.admins else "dev@wikigit.local")
            request.state.user_email = dev_user
            logger.debug(f"Dev mode: {dev_user} accessing {request.method} {request.url.path}")
            return await call_next(request)

        # Extract the IAP authentication header
        iap_header = request.headers.get("X-Goog-Authenticated-User-Email")

        if not iap_header:
            logger.warning(
                f"Authentication failed: Missing X-Goog-Authenticated-User-Email header for {request.url.path}"
            )
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "detail": "Authentication required. Missing X-Goog-Authenticated-User-Email header."
                },
            )

        # Parse email from IAP format: "accounts.google.com:user@example.com"
        user_email = self._parse_iap_email(iap_header)

        if not user_email:
            logger.warning(
                f"Authentication failed: Invalid IAP header format: {iap_header}"
            )
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "detail": "Authentication failed. Invalid IAP header format."
                },
            )

        # Store user email in request state for downstream access
        request.state.user_email = user_email

        logger.debug(
            f"Authenticated user: {user_email} accessing {request.method} {request.url.path}"
        )

        # Continue processing the request
        response = await call_next(request)
        return response

    @staticmethod
    def _parse_iap_email(iap_header: str) -> Optional[str]:
        """
        Parse user email from GCP IAP header format.

        GCP IAP provides the email in the format:
        "accounts.google.com:user@example.com"

        This method extracts just the email portion.

        Args:
            iap_header: The raw IAP header value

        Returns:
            Extracted email address, or None if parsing fails

        Examples:
            >>> AuthMiddleware._parse_iap_email("accounts.google.com:user@example.com")
            "user@example.com"
            >>> AuthMiddleware._parse_iap_email("user@example.com")
            "user@example.com"
            >>> AuthMiddleware._parse_iap_email("invalid")
            None
        """
        if not iap_header:
            return None

        # IAP format: "accounts.google.com:email@domain.com"
        if ":" in iap_header:
            parts = iap_header.split(":", 1)
            if len(parts) == 2:
                email = parts[1].strip()
                # Validate basic email format (contains @ and .)
                if "@" in email and "." in email.split("@")[1]:
                    return email
                return None

        # Fallback: if no colon, assume it's already just the email
        if "@" in iap_header and "." in iap_header.split("@")[1]:
            return iap_header.strip()

        return None


def get_current_user(request: Request) -> str:
    """
    FastAPI dependency to get the authenticated user's email.

    This dependency retrieves the user email that was extracted and stored
    by the AuthMiddleware. It should be used in route handlers that require
    authentication.

    Args:
        request: The FastAPI request object

    Returns:
        The authenticated user's email address

    Raises:
        HTTPException: 401 Unauthorized if user is not authenticated

    Usage:
        @app.get("/api/pages")
        async def list_pages(user_email: str = Depends(get_current_user)):
            return {"user": user_email, "pages": [...]}
    """
    user_email = getattr(request.state, "user_email", None)

    if not user_email:
        logger.error("Attempted to access authenticated route without user_email in request.state")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. User not authenticated.",
        )

    return user_email


def require_admin(request: Request) -> str:
    """
    FastAPI dependency to enforce admin-only access.

    This dependency first authenticates the user (like get_current_user),
    then checks if the user's email is in the app.admins list from the
    configuration. It should be used in route handlers that require admin
    privileges.

    Args:
        request: The FastAPI request object

    Returns:
        The authenticated admin user's email address

    Raises:
        HTTPException: 401 Unauthorized if user is not authenticated
        HTTPException: 403 Forbidden if user is not an admin

    Usage:
        @app.delete("/api/admin/users/{user_id}")
        async def delete_user(
            user_id: str,
            admin_email: str = Depends(require_admin)
        ):
            return {"deleted_by": admin_email, "user_id": user_id}
    """
    # First, ensure user is authenticated
    user_email = get_current_user(request)

    # Check if user is in the admin list
    if not settings.is_admin(user_email):
        logger.warning(
            f"Authorization denied: User {user_email} attempted to access admin-only resource: "
            f"{request.method} {request.url.path}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access forbidden. User {user_email} does not have admin privileges.",
        )

    logger.info(
        f"Admin access granted: {user_email} accessing {request.method} {request.url.path}"
    )

    return user_email


__all__ = [
    "AuthMiddleware",
    "get_current_user",
    "require_admin",
]

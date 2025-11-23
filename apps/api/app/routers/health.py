"""
Health check endpoint for WikiGit API.

This module provides a simple health check endpoint that can be used
for monitoring, load balancers, and container orchestration.
"""

from fastapi import APIRouter
from app.models.schemas import HealthCheck

router = APIRouter()


@router.get("/health", response_model=HealthCheck, tags=["health"])
async def health_check():
    """
    Health check endpoint.

    Returns basic system status information. This endpoint does not
    require authentication and can be used by monitoring systems.

    Returns:
        HealthCheck: System status and version information
    """
    return HealthCheck(status="healthy", version="0.1.0")

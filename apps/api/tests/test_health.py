"""Tests for the health check endpoint."""

from app.routers.health import health_check


class TestHealthCheck:
    """Tests for GET /health endpoint function."""

    async def test_health_check_returns_healthy_status(self):
        result = await health_check()
        assert result.status == "healthy"

    async def test_health_check_returns_version(self):
        result = await health_check()
        assert result.version == "0.1.0"

    async def test_health_check_includes_timestamp(self):
        result = await health_check()
        assert result.timestamp is not None

    async def test_health_check_returns_health_check_model(self):
        from app.models.schemas import HealthCheck

        result = await health_check()
        assert isinstance(result, HealthCheck)

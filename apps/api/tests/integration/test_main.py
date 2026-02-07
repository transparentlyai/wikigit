"""Integration tests for app/main.py.

Tests the root endpoint and basic app configuration.
"""

from unittest.mock import patch

from tests.integration.conftest import AUTH_HEADER


class TestRootEndpoint:
    """Tests for GET /."""

    async def test_root_returns_info(self, client):
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "WikiGit API - Multi-Repository Mode"
        assert data["version"] == "0.2.0"
        assert "docs" in data
        assert "health" in data


class TestAuthMiddleware:
    """Tests for authentication middleware behavior through the app."""

    async def test_unauthenticated_request_to_protected_route_returns_401(self, client):
        # /repositories is a protected route
        resp = await client.get("/repositories")
        assert resp.status_code == 401

    async def test_authenticated_request_passes_through(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.settings", mock_settings),
        ):
            mock_rs.list_repositories.return_value = []

            resp = await client.get("/repositories", headers=AUTH_HEADER)
        assert resp.status_code == 200

    async def test_invalid_iap_header_returns_401(self, client):
        resp = await client.get(
            "/repositories",
            headers={"X-Goog-Authenticated-User-Email": "invalid-no-at-sign"},
        )
        assert resp.status_code == 401

    async def test_health_endpoint_bypasses_auth(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200

    async def test_setup_status_bypasses_auth(self, client, mock_settings):
        with (
            patch("app.routers.setup.settings", mock_settings),
            patch("app.services.repository_service") as mock_rs,
        ):
            mock_rs.list_repositories.return_value = []
            resp = await client.get("/setup/status")
        assert resp.status_code == 200

    async def test_root_bypasses_auth(self, client):
        resp = await client.get("/")
        assert resp.status_code == 200

    async def test_plain_email_header_works(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.settings", mock_settings),
        ):
            mock_rs.list_repositories.return_value = []

            resp = await client.get(
                "/repositories",
                headers={"X-Goog-Authenticated-User-Email": "admin@example.com"},
            )
        assert resp.status_code == 200

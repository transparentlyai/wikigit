"""Integration tests for the search router.

Tests endpoints under /search.
"""

from unittest.mock import patch, MagicMock

from app.routers.search import get_search_service
from tests.integration.conftest import AUTH_HEADER, USER_HEADER


class TestSearchArticles:
    """Tests for GET /search."""

    async def test_search_returns_results(self, client, mock_settings):
        mock_search_svc = MagicMock()
        mock_search_svc.search.return_value = [
            MagicMock(
                path="repo:test.md",
                title="Test Article",
                snippet="A <em>test</em> article",
                score=0.9,
                repository_id="repo",
                repository_name="Repo",
            )
        ]

        from app.main import app

        app.dependency_overrides[get_search_service] = lambda: mock_search_svc
        try:
            with patch("app.routers.search.settings", mock_settings):
                resp = await client.get("/search?q=test", headers=AUTH_HEADER)

            assert resp.status_code == 200
            data = resp.json()
            assert len(data) == 1
            assert data[0]["title"] == "Test Article"
        finally:
            app.dependency_overrides.pop(get_search_service, None)

    async def test_search_requires_query_param(self, client, mock_settings):
        with patch("app.routers.search.settings", mock_settings):
            resp = await client.get("/search", headers=AUTH_HEADER)
        assert resp.status_code == 422  # Validation error

    async def test_search_empty_query_validation(self, client, mock_settings):
        with patch("app.routers.search.settings", mock_settings):
            resp = await client.get("/search?q=", headers=AUTH_HEADER)
        # min_length=1 causes 422
        assert resp.status_code == 422

    async def test_search_with_repository_filter(self, client, mock_settings):
        mock_search_svc = MagicMock()
        mock_search_svc.search.return_value = []

        from app.main import app

        app.dependency_overrides[get_search_service] = lambda: mock_search_svc
        try:
            with patch("app.routers.search.settings", mock_settings):
                resp = await client.get(
                    "/search?q=test&repository_id=my-repo", headers=AUTH_HEADER
                )

            assert resp.status_code == 200
            mock_search_svc.search.assert_called_once_with(
                "test", limit=20, repository_id="my-repo"
            )
        finally:
            app.dependency_overrides.pop(get_search_service, None)

    async def test_search_with_custom_limit(self, client, mock_settings):
        mock_search_svc = MagicMock()
        mock_search_svc.search.return_value = []

        from app.main import app

        app.dependency_overrides[get_search_service] = lambda: mock_search_svc
        try:
            with patch("app.routers.search.settings", mock_settings):
                resp = await client.get("/search?q=test&limit=5", headers=AUTH_HEADER)

            assert resp.status_code == 200
            mock_search_svc.search.assert_called_once_with(
                "test", limit=5, repository_id=None
            )
        finally:
            app.dependency_overrides.pop(get_search_service, None)

    async def test_search_service_error_returns_500(self, client, mock_settings):
        mock_search_svc = MagicMock()
        mock_search_svc.search.side_effect = RuntimeError("Index corrupt")

        from app.main import app

        app.dependency_overrides[get_search_service] = lambda: mock_search_svc
        try:
            with patch("app.routers.search.settings", mock_settings):
                resp = await client.get("/search?q=test", headers=AUTH_HEADER)

            assert resp.status_code == 500
        finally:
            app.dependency_overrides.pop(get_search_service, None)

    async def test_unauthenticated_returns_401(self, client):
        resp = await client.get("/search?q=test")
        assert resp.status_code == 401


class TestReindex:
    """Tests for POST /search/reindex."""

    async def test_admin_can_reindex(self, client, mock_settings):
        mock_search_svc = MagicMock()
        mock_search_svc.rebuild_index.return_value = 42

        from app.main import app

        app.dependency_overrides[get_search_service] = lambda: mock_search_svc
        try:
            with (
                patch("app.routers.search.settings", mock_settings),
                patch("app.routers.search.MultiRepoGitService"),
            ):
                resp = await client.post("/search/reindex", headers=AUTH_HEADER)

            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "completed"
            assert data["document_count"] == 42
            assert "42" in data["message"]
        finally:
            app.dependency_overrides.pop(get_search_service, None)

    async def test_non_admin_cannot_reindex(self, client, mock_settings):
        with patch("app.routers.search.settings", mock_settings):
            resp = await client.post("/search/reindex", headers=USER_HEADER)
        assert resp.status_code == 403

    async def test_reindex_error_returns_500(self, client, mock_settings):
        mock_search_svc = MagicMock()
        mock_search_svc.rebuild_index.side_effect = RuntimeError("Index error")

        from app.main import app

        app.dependency_overrides[get_search_service] = lambda: mock_search_svc
        try:
            with (
                patch("app.routers.search.settings", mock_settings),
                patch("app.routers.search.MultiRepoGitService"),
            ):
                resp = await client.post("/search/reindex", headers=AUTH_HEADER)

            assert resp.status_code == 500
        finally:
            app.dependency_overrides.pop(get_search_service, None)

    async def test_unauthenticated_returns_401(self, client):
        resp = await client.post("/search/reindex")
        assert resp.status_code == 401

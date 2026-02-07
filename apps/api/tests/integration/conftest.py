"""Shared fixtures for integration tests using httpx AsyncClient."""

import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import patch, MagicMock
from pathlib import Path


# Auth header used across all integration tests
AUTH_HEADER = {
    "X-Goog-Authenticated-User-Email": "accounts.google.com:admin@example.com"
}
USER_HEADER = {
    "X-Goog-Authenticated-User-Email": "accounts.google.com:user@example.com"
}


@pytest.fixture
def mock_settings():
    """Create a mock settings object matching the real Settings structure."""
    s = MagicMock()
    s.app.name = "WikiGit"
    s.app.description = "Test Wiki"
    s.app.domain = "localhost:3003"
    s.app.max_file_size_mb = 10
    s.app.max_file_size_bytes = 10 * 1024 * 1024
    s.app.admins = ["admin@example.com"]
    s.app.home_page_repository = None
    s.app.home_page_article = None
    s.is_admin = lambda email: email in ["admin@example.com"]

    s.search.index_path = "/tmp/test-index"
    s.search.index_dir = Path("/tmp/test-index")
    s.search.rebuild_on_startup = False

    s.multi_repository.enabled = True
    s.multi_repository.repositories_root_dir = "/tmp/test-repos"
    s.multi_repository.root_dir = Path("/tmp/test-repos")
    s.multi_repository.auto_sync_interval_minutes = 15
    s.multi_repository.author_name = "WikiGit Bot"
    s.multi_repository.author_email = "bot@wikigit.app"
    s.multi_repository.default_branch = "main"
    s.multi_repository.github = None

    return s


@pytest.fixture
async def client(mock_settings):
    """Create an async test client with mocked dependencies.

    Patches the settings singleton used by the auth middleware and routers,
    and the sync scheduler to avoid real filesystem/git operations during
    app startup (lifespan).
    """
    with (
        patch("app.middleware.auth.settings", mock_settings),
        patch("app.config.settings.settings", mock_settings),
        patch("app.services.repository_service", MagicMock()),
        patch("app.services.frontmatter_service", MagicMock()),
        patch("app.services.sync_scheduler.get_scheduler") as mock_sched,
    ):
        mock_scheduler = MagicMock()
        mock_sched.return_value = mock_scheduler

        from app.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

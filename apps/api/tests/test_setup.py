"""Tests for the setup status endpoint."""

from unittest.mock import MagicMock, patch


class TestGetSetupStatus:
    """Tests for the GET /setup/status endpoint function."""

    @patch("app.services.repository_service")
    @patch("app.routers.setup.settings")
    async def test_no_github_no_repos_is_incomplete(self, mock_settings, mock_repo_svc):
        mock_settings.multi_repository.github = None
        mock_repo_svc.list_repositories.return_value = []

        from app.routers.setup import get_setup_status

        result = await get_setup_status()

        assert result["setup_complete"] is False
        assert result["github_configured"] is False
        assert result["repository_count"] == 0
        assert result["enabled_repository_count"] == 0
        assert "GitHub user ID not configured" in result["issues"]
        assert "No repositories added" in result["issues"]
        assert result["redirect_to"] == "/admin"

    @patch("app.services.repository_service")
    @patch("app.routers.setup.settings")
    async def test_github_configured_with_enabled_repos_is_complete(
        self, mock_settings, mock_repo_svc
    ):
        mock_github = MagicMock()
        mock_github.user_id = "test-user"
        mock_settings.multi_repository.github = mock_github
        mock_repo_svc.list_repositories.return_value = [
            {"name": "wiki", "enabled": True}
        ]

        from app.routers.setup import get_setup_status

        result = await get_setup_status()

        assert result["setup_complete"] is True
        assert result["github_configured"] is True
        assert result["repository_count"] == 1
        assert result["enabled_repository_count"] == 1
        assert result["issues"] == []
        assert result["redirect_to"] is None

    @patch("app.services.repository_service")
    @patch("app.routers.setup.settings")
    async def test_repos_exist_but_none_enabled_is_incomplete(
        self, mock_settings, mock_repo_svc
    ):
        mock_github = MagicMock()
        mock_github.user_id = "test-user"
        mock_settings.multi_repository.github = mock_github
        mock_repo_svc.list_repositories.return_value = [
            {"name": "wiki", "enabled": False}
        ]

        from app.routers.setup import get_setup_status

        result = await get_setup_status()

        assert result["setup_complete"] is False
        assert result["github_configured"] is True
        assert result["repository_count"] == 1
        assert result["enabled_repository_count"] == 0
        assert "No repositories enabled" in result["issues"]
        assert result["redirect_to"] == "/admin"

    @patch("app.services.repository_service")
    @patch("app.routers.setup.settings")
    async def test_github_configured_no_repos_is_incomplete(
        self, mock_settings, mock_repo_svc
    ):
        mock_github = MagicMock()
        mock_github.user_id = "test-user"
        mock_settings.multi_repository.github = mock_github
        mock_repo_svc.list_repositories.return_value = []

        from app.routers.setup import get_setup_status

        result = await get_setup_status()

        assert result["setup_complete"] is False
        assert result["github_configured"] is True
        assert result["repository_count"] == 0
        assert "No repositories added" in result["issues"]

    @patch("app.services.repository_service")
    @patch("app.routers.setup.settings")
    async def test_no_github_user_id_means_not_configured(
        self, mock_settings, mock_repo_svc
    ):
        mock_github = MagicMock()
        mock_github.user_id = ""
        mock_settings.multi_repository.github = mock_github
        mock_repo_svc.list_repositories.return_value = []

        from app.routers.setup import get_setup_status

        result = await get_setup_status()

        assert result["github_configured"] is False

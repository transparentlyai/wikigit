"""Integration tests for the repositories router.

Tests endpoints under /repositories.
"""

from unittest.mock import patch, MagicMock, AsyncMock

from tests.integration.conftest import AUTH_HEADER, USER_HEADER

SAMPLE_REPO_STATUS = {
    "id": "owner-test-repo",
    "name": "test-repo",
    "owner": "owner",
    "remote_url": "https://github.com/owner/test-repo.git",
    "enabled": True,
    "read_only": False,
    "default_branch": "main",
    "last_synced": None,
    "sync_status": "never",
    "error_message": None,
    "local_path": "/tmp/repos/owner-test-repo",
    "has_local_changes": False,
    "ahead_of_remote": 0,
    "behind_of_remote": 0,
}


class TestListRepositories:
    """Tests for GET /repositories."""

    async def test_returns_repository_list(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.settings", mock_settings),
        ):
            mock_rs.list_repositories.return_value = [
                {"id": "owner-test-repo", "name": "test-repo"}
            ]
            mock_rs.get_repository_status.return_value = SAMPLE_REPO_STATUS

            resp = await client.get("/repositories", headers=AUTH_HEADER)

        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["repositories"][0]["id"] == "owner-test-repo"

    async def test_returns_empty_list(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.settings", mock_settings),
        ):
            mock_rs.list_repositories.return_value = []

            resp = await client.get("/repositories", headers=AUTH_HEADER)

        assert resp.status_code == 200
        assert resp.json()["total"] == 0
        assert resp.json()["repositories"] == []

    async def test_unauthenticated_returns_401(self, client):
        resp = await client.get("/repositories")
        assert resp.status_code == 401


class TestGetRepository:
    """Tests for GET /repositories/{id}."""

    async def test_returns_repository_details(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.settings", mock_settings),
        ):
            mock_rs.get_repository_status.return_value = SAMPLE_REPO_STATUS

            resp = await client.get(
                "/repositories/owner-test-repo", headers=AUTH_HEADER
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "owner-test-repo"
        assert data["name"] == "test-repo"
        assert data["sync_status"] == "never"

    async def test_not_found_returns_404(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.settings", mock_settings),
        ):
            mock_rs.get_repository_status.side_effect = ValueError("Not found")

            resp = await client.get("/repositories/nonexistent", headers=AUTH_HEADER)

        assert resp.status_code == 404


class TestAddRepositories:
    """Tests for POST /repositories."""

    async def test_missing_repository_ids_returns_400(self, client, mock_settings):
        with patch("app.routers.repositories.settings", mock_settings):
            resp = await client.post(
                "/repositories",
                json={},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 400

    async def test_no_github_configured_returns_400(self, client, mock_settings):
        mock_settings.multi_repository.github = None
        with patch("app.routers.repositories.settings", mock_settings):
            resp = await client.post(
                "/repositories",
                json={"repository_ids": ["owner/repo"]},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 400

    async def test_no_github_token_returns_400(self, client, mock_settings):
        mock_github = MagicMock()
        mock_github.token = None
        mock_github.token_env_var = "GITHUB_TOKEN"
        mock_settings.multi_repository.github = mock_github

        with patch("app.routers.repositories.settings", mock_settings):
            resp = await client.post(
                "/repositories",
                json={"repository_ids": ["owner/repo"]},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 400

    async def test_add_repositories_success(self, client, mock_settings):
        mock_github = MagicMock()
        mock_github.token = "fake-token"
        mock_github.token_env_var = "GITHUB_TOKEN"
        mock_settings.multi_repository.github = mock_github

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "full_name": "owner/repo1",
            "name": "repo1",
            "clone_url": "https://github.com/owner/repo1.git",
            "owner": {"login": "owner"},
            "default_branch": "main",
        }

        mock_httpx_client = AsyncMock()
        mock_httpx_client.__aenter__ = AsyncMock(return_value=mock_httpx_client)
        mock_httpx_client.__aexit__ = AsyncMock(return_value=False)
        mock_httpx_client.get = AsyncMock(return_value=mock_response)

        with (
            patch("app.routers.repositories.settings", mock_settings),
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.trigger_search_reindex"),
            patch("httpx.AsyncClient", return_value=mock_httpx_client),
        ):
            resp = await client.post(
                "/repositories",
                json={"repository_ids": ["owner/repo1"]},
                headers=AUTH_HEADER,
            )

        assert resp.status_code == 204
        mock_rs.clone_repository.assert_called_once()

    async def test_unauthenticated_returns_401(self, client):
        resp = await client.post(
            "/repositories",
            json={"repository_ids": ["owner/repo"]},
        )
        assert resp.status_code == 401


class TestUpdateRepository:
    """Tests for PUT /repositories/{id}."""

    async def test_update_repository_settings(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.settings", mock_settings),
            patch("app.routers.repositories.trigger_search_reindex"),
        ):
            mock_rs.get_repository_status.return_value = {
                **SAMPLE_REPO_STATUS,
                "read_only": True,
            }

            resp = await client.put(
                "/repositories/owner-test-repo",
                json={"read_only": True},
                headers=AUTH_HEADER,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["read_only"] is True

    async def test_update_nonexistent_returns_404(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.settings", mock_settings),
        ):
            mock_rs.update_repository.side_effect = ValueError("Not found")

            resp = await client.put(
                "/repositories/nonexistent",
                json={"enabled": False},
                headers=AUTH_HEADER,
            )

        assert resp.status_code == 404

    async def test_enable_change_triggers_reindex(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.settings", mock_settings),
            patch("app.routers.repositories.trigger_search_reindex") as mock_reindex,
        ):
            mock_rs.get_repository_status.return_value = {
                **SAMPLE_REPO_STATUS,
                "enabled": False,
            }

            resp = await client.put(
                "/repositories/owner-test-repo",
                json={"enabled": False},
                headers=AUTH_HEADER,
            )

        assert resp.status_code == 200
        mock_reindex.assert_called_once()


class TestSyncRepository:
    """Tests for POST /repositories/{id}/sync."""

    async def test_sync_success(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.settings", mock_settings),
        ):
            mock_rs.sync_repository.return_value = {
                "repository_id": "owner-test-repo",
                "status": "success",
                "message": "Synced successfully",
                "commits_pulled": 2,
                "commits_pushed": 0,
                "files_changed": 3,
            }

            resp = await client.post(
                "/repositories/owner-test-repo/sync", headers=AUTH_HEADER
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["commits_pulled"] == 2

    async def test_sync_nonexistent_returns_404(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.settings", mock_settings),
        ):
            mock_rs.sync_repository.side_effect = ValueError("Not found")

            resp = await client.post(
                "/repositories/nonexistent/sync", headers=AUTH_HEADER
            )

        assert resp.status_code == 404

    async def test_sync_error_returns_500(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.settings", mock_settings),
        ):
            mock_rs.sync_repository.side_effect = RuntimeError("Git error")

            resp = await client.post(
                "/repositories/owner-test-repo/sync", headers=AUTH_HEADER
            )

        assert resp.status_code == 500


class TestDeleteRepository:
    """Tests for DELETE /repositories/{id}."""

    async def test_delete_success(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service"),
            patch("app.routers.repositories.settings", mock_settings),
            patch("app.routers.repositories.trigger_search_reindex"),
        ):
            resp = await client.delete(
                "/repositories/owner-test-repo", headers=AUTH_HEADER
            )

        assert resp.status_code == 204

    async def test_delete_nonexistent_returns_404(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service") as mock_rs,
            patch("app.routers.repositories.settings", mock_settings),
        ):
            mock_rs.remove_repository.side_effect = ValueError("Not found")

            resp = await client.delete("/repositories/nonexistent", headers=AUTH_HEADER)

        assert resp.status_code == 404

    async def test_delete_triggers_reindex(self, client, mock_settings):
        with (
            patch("app.routers.repositories.repository_service"),
            patch("app.routers.repositories.settings", mock_settings),
            patch("app.routers.repositories.trigger_search_reindex") as mock_reindex,
        ):
            resp = await client.delete(
                "/repositories/owner-test-repo", headers=AUTH_HEADER
            )

        assert resp.status_code == 204
        mock_reindex.assert_called_once()


class TestScanGitHubRepositories:
    """Tests for GET /repositories/scan."""

    async def test_no_github_configured_returns_400(self, client, mock_settings):
        mock_settings.multi_repository.github = None
        with patch("app.routers.repositories.settings", mock_settings):
            resp = await client.get("/repositories/scan", headers=AUTH_HEADER)
        assert resp.status_code == 400

    async def test_no_github_token_returns_400(self, client, mock_settings):
        mock_github = MagicMock()
        mock_github.token = None
        mock_github.token_env_var = "GITHUB_TOKEN"
        mock_settings.multi_repository.github = mock_github

        with patch("app.routers.repositories.settings", mock_settings):
            resp = await client.get("/repositories/scan", headers=AUTH_HEADER)
        assert resp.status_code == 400

    async def test_scan_returns_repositories(self, client, mock_settings):
        mock_github = MagicMock()
        mock_github.token = "fake-token"
        mock_github.token_env_var = "GITHUB_TOKEN"
        mock_settings.multi_repository.github = mock_github

        # Mock the httpx call inside the endpoint
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {
                "full_name": "owner/repo1",
                "name": "repo1",
                "clone_url": "https://github.com/owner/repo1.git",
                "private": False,
                "description": "A test repo",
            }
        ]

        mock_httpx_client = AsyncMock()
        mock_httpx_client.__aenter__ = AsyncMock(return_value=mock_httpx_client)
        mock_httpx_client.__aexit__ = AsyncMock(return_value=False)
        mock_httpx_client.get = AsyncMock(return_value=mock_response)

        with (
            patch("app.routers.repositories.settings", mock_settings),
            patch("httpx.AsyncClient", return_value=mock_httpx_client),
        ):
            resp = await client.get("/repositories/scan", headers=AUTH_HEADER)

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["full_name"] == "owner/repo1"

    async def test_scan_github_auth_failure_returns_error(self, client, mock_settings):
        mock_github = MagicMock()
        mock_github.token = "bad-token"
        mock_github.token_env_var = "GITHUB_TOKEN"
        mock_settings.multi_repository.github = mock_github

        mock_response = MagicMock()
        mock_response.status_code = 401

        mock_httpx_client = AsyncMock()
        mock_httpx_client.__aenter__ = AsyncMock(return_value=mock_httpx_client)
        mock_httpx_client.__aexit__ = AsyncMock(return_value=False)
        mock_httpx_client.get = AsyncMock(return_value=mock_response)

        with (
            patch("app.routers.repositories.settings", mock_settings),
            patch("httpx.AsyncClient", return_value=mock_httpx_client),
        ):
            resp = await client.get("/repositories/scan", headers=AUTH_HEADER)

        # The inner HTTPException(400) is caught by the outer except block,
        # resulting in a 500 response
        assert resp.status_code == 500

    async def test_unauthenticated_returns_401(self, client):
        resp = await client.get("/repositories/scan")
        assert resp.status_code == 401


class TestGitHubSettings:
    """Tests for GET/POST /repositories/github/settings."""

    async def test_get_github_settings_no_config(self, client, mock_settings):
        mock_settings.multi_repository.github = None
        with patch("app.routers.repositories.settings", mock_settings):
            resp = await client.get(
                "/repositories/github/settings", headers=AUTH_HEADER
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == ""
        assert data["token_env_var"] == "GITHUB_TOKEN"

    async def test_get_github_settings_with_config(self, client, mock_settings):
        mock_github = MagicMock()
        mock_github.user_id = "test-user"
        mock_github.token_env_var = "MY_TOKEN"
        mock_settings.multi_repository.github = mock_github

        with patch("app.routers.repositories.settings", mock_settings):
            resp = await client.get(
                "/repositories/github/settings", headers=AUTH_HEADER
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == "test-user"
        assert data["token_env_var"] == "MY_TOKEN"

    async def test_get_github_settings_non_admin_returns_403(
        self, client, mock_settings
    ):
        with patch("app.routers.repositories.settings", mock_settings):
            resp = await client.get(
                "/repositories/github/settings", headers=USER_HEADER
            )
        assert resp.status_code == 403


class TestGitHubTestConnection:
    """Tests for POST /repositories/github/test."""

    async def test_no_token_env_var_returns_400(self, client, mock_settings):
        with patch("app.routers.repositories.settings", mock_settings):
            resp = await client.post(
                "/repositories/github/test",
                json={"token_env_var": "NONEXISTENT_TOKEN", "user_id": "user"},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 400

    async def test_successful_connection(self, client, mock_settings):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "login": "testuser",
            "name": "Test User",
            "email": "test@example.com",
        }

        mock_httpx_client = AsyncMock()
        mock_httpx_client.__aenter__ = AsyncMock(return_value=mock_httpx_client)
        mock_httpx_client.__aexit__ = AsyncMock(return_value=False)
        mock_httpx_client.get = AsyncMock(return_value=mock_response)

        with (
            patch("app.routers.repositories.settings", mock_settings),
            patch.dict("os.environ", {"TEST_GH_TOKEN": "fake-token"}),
            patch("httpx.AsyncClient", return_value=mock_httpx_client),
        ):
            resp = await client.post(
                "/repositories/github/test",
                json={"token_env_var": "TEST_GH_TOKEN", "user_id": "testuser"},
                headers=AUTH_HEADER,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "testuser" in data["message"]

    async def test_invalid_token_returns_error(self, client, mock_settings):
        mock_response = MagicMock()
        mock_response.status_code = 401

        mock_httpx_client = AsyncMock()
        mock_httpx_client.__aenter__ = AsyncMock(return_value=mock_httpx_client)
        mock_httpx_client.__aexit__ = AsyncMock(return_value=False)
        mock_httpx_client.get = AsyncMock(return_value=mock_response)

        with (
            patch("app.routers.repositories.settings", mock_settings),
            patch.dict("os.environ", {"TEST_GH_TOKEN": "bad-token"}),
            patch("httpx.AsyncClient", return_value=mock_httpx_client),
        ):
            resp = await client.post(
                "/repositories/github/test",
                json={"token_env_var": "TEST_GH_TOKEN", "user_id": "user"},
                headers=AUTH_HEADER,
            )

        # The inner HTTPException(400) is caught by the outer except block
        assert resp.status_code == 500

    async def test_non_admin_returns_403(self, client, mock_settings):
        with patch("app.routers.repositories.settings", mock_settings):
            resp = await client.post(
                "/repositories/github/test",
                json={"token_env_var": "GITHUB_TOKEN", "user_id": "user"},
                headers=USER_HEADER,
            )
        assert resp.status_code == 403


class TestSaveGitHubSettings:
    """Tests for POST /repositories/github/settings."""

    async def test_save_settings_success(self, client, mock_settings, tmp_path):
        import yaml
        import app.routers.repositories as repos_module

        # Set up a temp config.yaml
        project_root = tmp_path / "project_root"
        config_root = project_root / "1"
        fake_dir = config_root / "2" / "3" / "4" / "5"
        fake_dir.mkdir(parents=True, exist_ok=True)
        fake_file = fake_dir / "repositories.py"
        fake_file.touch()

        config_data = {
            "app": {"app_name": "WikiGit", "admins": ["admin@example.com"]},
            "search": {"index_dir": "/tmp/test-index"},
            "multi_repository": {
                "enabled": True,
                "repositories_root_dir": "/tmp/test-repos",
                "auto_sync_interval_minutes": 15,
            },
        }
        config_file = config_root / "config.yaml"
        config_file.write_text(yaml.safe_dump(config_data))

        original_file = repos_module.__file__
        try:
            with (
                patch("app.routers.repositories.settings", mock_settings),
                patch.object(repos_module, "__file__", str(fake_file)),
            ):
                resp = await client.post(
                    "/repositories/github/settings",
                    json={"token_env_var": "MY_GH_TOKEN", "user_id": "myuser"},
                    headers=AUTH_HEADER,
                )
        finally:
            repos_module.__file__ = original_file

        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True

    async def test_save_settings_non_admin_returns_403(self, client, mock_settings):
        with patch("app.routers.repositories.settings", mock_settings):
            resp = await client.post(
                "/repositories/github/settings",
                json={"token_env_var": "GITHUB_TOKEN", "user_id": "user"},
                headers=USER_HEADER,
            )
        assert resp.status_code == 403

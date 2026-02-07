"""Tests for the repository service."""

import json
from unittest.mock import MagicMock, patch

import pytest
from git.exc import GitCommandError

from app.services.repository_service import RepositoryService


# ============================================================================
# _load_repositories
# ============================================================================


class TestLoadRepositories:
    """Tests for loading repository config from JSON."""

    def test_loads_from_json_file(self, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        config_path.parent.mkdir(parents=True)
        data = {
            "repositories": {
                "owner/repo": {
                    "id": "owner/repo",
                    "name": "repo",
                    "owner": "owner",
                    "remote_url": "https://github.com/owner/repo.git",
                    "local_path": "/tmp/repos/owner/repo",
                    "enabled": True,
                }
            }
        }
        config_path.write_text(json.dumps(data))

        service = RepositoryService(config_path)
        assert "owner/repo" in service.repositories
        assert service.repositories["owner/repo"]["name"] == "repo"

    def test_missing_file_returns_empty(self, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)
        assert service.repositories == {}

    def test_corrupt_json_returns_empty(self, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        config_path.parent.mkdir(parents=True)
        config_path.write_text("{invalid json!!!")

        service = RepositoryService(config_path)
        assert service.repositories == {}


# ============================================================================
# _save_repositories
# ============================================================================


class TestSaveRepositories:
    """Tests for saving repository config to JSON."""

    def test_writes_valid_json(self, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)
        service.repositories = {"test/repo": {"id": "test/repo", "name": "repo"}}
        service._save_repositories()

        data = json.loads(config_path.read_text())
        assert "repositories" in data
        assert data["repositories"]["test/repo"]["name"] == "repo"


# ============================================================================
# add_repository
# ============================================================================


class TestAddRepository:
    """Tests for adding a repository."""

    def test_creates_entry_and_saves(self, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)

        result = service.add_repository(
            repo_id="owner/wiki",
            name="wiki",
            owner="owner",
            remote_url="https://github.com/owner/wiki.git",
            local_path=tmp_path / "repos" / "owner" / "wiki",
        )

        assert result["id"] == "owner/wiki"
        assert result["name"] == "wiki"
        assert result["enabled"] is False  # default
        assert result["read_only"] is True  # default
        assert result["sync_status"] == "never"
        assert result["created_at"] is not None

        # Verify it was persisted
        saved = json.loads(config_path.read_text())
        assert "owner/wiki" in saved["repositories"]

    def test_default_values(self, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)

        result = service.add_repository(
            repo_id="test/repo",
            name="repo",
            owner="test",
            remote_url="https://github.com/test/repo.git",
            local_path=tmp_path / "repos" / "test" / "repo",
        )

        assert result["last_synced"] is None
        assert result["error_message"] is None
        assert result["default_branch"] == "main"


# ============================================================================
# get_repository
# ============================================================================


class TestGetRepository:
    """Tests for getting repository metadata."""

    def test_returns_metadata(self, repos_config_file, sample_repo_metadata):
        service = RepositoryService(repos_config_file)
        repo = service.get_repository("owner/test-repo")
        assert repo["name"] == "test-repo"
        assert repo["owner"] == "owner"

    def test_raises_for_unknown_repo(self, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)

        with pytest.raises(ValueError, match="not found"):
            service.get_repository("nonexistent/repo")


# ============================================================================
# update_repository
# ============================================================================


class TestUpdateRepository:
    """Tests for updating repository settings."""

    def test_modifies_allowed_fields(self, repos_config_file):
        service = RepositoryService(repos_config_file)

        result = service.update_repository(
            "owner/test-repo",
            {"enabled": False, "read_only": True, "name": "new-name"},
        )

        assert result["enabled"] is False
        assert result["read_only"] is True
        assert result["name"] == "new-name"

    def test_ignores_disallowed_fields(self, repos_config_file):
        service = RepositoryService(repos_config_file)
        original = service.get_repository("owner/test-repo")
        original_url = original["remote_url"]

        service.update_repository(
            "owner/test-repo",
            {"remote_url": "https://evil.com/repo.git", "enabled": True},
        )

        updated = service.get_repository("owner/test-repo")
        assert updated["remote_url"] == original_url  # Not changed
        assert updated["enabled"] is True  # This one was allowed

    def test_raises_for_unknown_repo(self, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)

        with pytest.raises(ValueError, match="not found"):
            service.update_repository("nonexistent/repo", {"enabled": True})


# ============================================================================
# list_repositories
# ============================================================================


class TestListRepositories:
    """Tests for listing all repositories."""

    def test_returns_all_repos(self, repos_config_file):
        service = RepositoryService(repos_config_file)
        repos = service.list_repositories()
        assert len(repos) == 1
        assert repos[0]["id"] == "owner/test-repo"

    def test_returns_empty_when_no_repos(self, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)
        repos = service.list_repositories()
        assert repos == []


# ============================================================================
# remove_repository
# ============================================================================


class TestRemoveRepository:
    """Tests for removing a repository."""

    def test_deletes_from_config_and_filesystem(self, tmp_path, sample_repo_metadata):
        config_path = tmp_path / "config" / "repositories.json"
        config_path.parent.mkdir(parents=True)

        # Create a local directory to simulate the repo
        local_dir = tmp_path / "repos" / "owner" / "test-repo"
        local_dir.mkdir(parents=True)
        sample_repo_metadata["local_path"] = str(local_dir)

        data = {"repositories": {"owner/test-repo": sample_repo_metadata}}
        config_path.write_text(json.dumps(data))

        service = RepositoryService(config_path)
        service.remove_repository("owner/test-repo")

        # Verify removed from config
        assert "owner/test-repo" not in service.repositories
        saved = json.loads(config_path.read_text())
        assert "owner/test-repo" not in saved["repositories"]

        # Verify local directory deleted
        assert not local_dir.exists()

    def test_raises_for_unknown_repo(self, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)

        with pytest.raises(ValueError, match="not found"):
            service.remove_repository("nonexistent/repo")


# ============================================================================
# _get_authenticated_url
# ============================================================================


class TestGetAuthenticatedUrl:
    """Tests for URL authentication injection."""

    @patch("app.services.repository_service.settings")
    def test_injects_github_token(self, mock_settings, tmp_path):
        mock_github = MagicMock()
        mock_github.token = "ghp_secret"
        mock_settings.multi_repository.github = mock_github

        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)

        url = service._get_authenticated_url("https://github.com/owner/repo.git")
        assert url == "https://ghp_secret@github.com/owner/repo.git"

    @patch("app.services.repository_service.settings")
    def test_returns_original_url_without_token(self, mock_settings, tmp_path):
        mock_settings.multi_repository.github = None

        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)

        url = service._get_authenticated_url("https://github.com/owner/repo.git")
        assert url == "https://github.com/owner/repo.git"

    @patch("app.services.repository_service.settings")
    def test_injects_token_in_non_github_https_url(self, mock_settings, tmp_path):
        mock_github = MagicMock()
        mock_github.token = "ghp_abc"
        mock_settings.multi_repository.github = mock_github

        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)

        url = service._get_authenticated_url("https://example.com/repo.git")
        assert url == "https://ghp_abc@example.com/repo.git"

    @patch("app.services.repository_service.settings")
    def test_returns_original_for_non_https_url(self, mock_settings, tmp_path):
        mock_github = MagicMock()
        mock_github.token = "ghp_abc"
        mock_settings.multi_repository.github = mock_github

        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)

        url = service._get_authenticated_url("git@github.com:owner/repo.git")
        assert url == "git@github.com:owner/repo.git"


# ============================================================================
# _sanitize_error
# ============================================================================


class TestSanitizeError:
    """Tests for removing tokens from error messages."""

    @patch("app.services.repository_service.settings")
    def test_removes_token_from_message(self, mock_settings, tmp_path):
        mock_github = MagicMock()
        mock_github.token = "ghp_supersecret"
        mock_settings.multi_repository.github = mock_github

        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)

        sanitized = service._sanitize_error(
            "Failed: https://ghp_supersecret@github.com/repo.git"
        )
        assert "ghp_supersecret" not in sanitized
        assert "***TOKEN***" in sanitized

    @patch("app.services.repository_service.settings")
    def test_no_token_returns_message_unchanged(self, mock_settings, tmp_path):
        mock_settings.multi_repository.github = None

        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)

        msg = "Some error occurred"
        assert service._sanitize_error(msg) == msg


# ============================================================================
# get_repository_status
# ============================================================================


class TestGetRepositoryStatus:
    """Tests for getting repository status."""

    def test_returns_status_dict(self, repos_config_file, sample_repo_metadata):
        service = RepositoryService(repos_config_file)
        status = service.get_repository_status("owner/test-repo")

        assert status["id"] == "owner/test-repo"
        assert status["name"] == "test-repo"
        assert status["owner"] == "owner"
        assert status["enabled"] is True
        assert "has_local_changes" in status
        assert "ahead_of_remote" in status
        assert "behind_of_remote" in status

    def test_raises_for_unknown_repo(self, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)

        with pytest.raises(ValueError, match="not found"):
            service.get_repository_status("nonexistent/repo")


# ============================================================================
# sync_repository
# ============================================================================


class TestSyncRepository:
    """Tests for repository sync operations."""

    @patch("app.services.repository_service.settings")
    @patch("app.services.repository_service.Repo")
    def test_sync_success(self, mock_repo_cls, mock_settings, tmp_path):
        mock_settings.multi_repository.github = None

        # Set up config
        config_path = tmp_path / "config" / "repositories.json"
        config_path.parent.mkdir(parents=True)
        local_path = tmp_path / "repos" / "owner" / "repo"
        local_path.mkdir(parents=True)

        repo_data = {
            "id": "owner/repo",
            "name": "repo",
            "owner": "owner",
            "remote_url": "https://github.com/owner/repo.git",
            "local_path": str(local_path),
            "enabled": True,
            "read_only": True,
            "default_branch": "main",
            "last_synced": None,
            "sync_status": "never",
            "error_message": None,
        }
        data = {"repositories": {"owner/repo": repo_data}}
        config_path.write_text(json.dumps(data))

        # Mock git repo
        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo

        mock_origin = MagicMock()
        mock_repo.remote.return_value = mock_origin

        # No commits to merge (up to date)
        mock_merge_base = [MagicMock()]
        mock_repo.merge_base.return_value = mock_merge_base
        mock_repo.iter_commits.return_value = []

        service = RepositoryService(config_path)
        result = service.sync_repository("owner/repo")

        assert result["status"] == "success"
        assert result["repository_id"] == "owner/repo"

    @patch("app.services.repository_service.settings")
    @patch("app.services.repository_service.Repo")
    def test_sync_error_handling(self, mock_repo_cls, mock_settings, tmp_path):
        mock_settings.multi_repository.github = None

        config_path = tmp_path / "config" / "repositories.json"
        config_path.parent.mkdir(parents=True)
        local_path = tmp_path / "repos" / "owner" / "repo"
        local_path.mkdir(parents=True)

        repo_data = {
            "id": "owner/repo",
            "name": "repo",
            "owner": "owner",
            "remote_url": "https://github.com/owner/repo.git",
            "local_path": str(local_path),
            "enabled": True,
            "read_only": False,
            "default_branch": "main",
            "last_synced": None,
            "sync_status": "never",
            "error_message": None,
        }
        data = {"repositories": {"owner/repo": repo_data}}
        config_path.write_text(json.dumps(data))

        # Make Repo constructor raise
        mock_repo_cls.side_effect = Exception("Git error: cannot open repo")

        service = RepositoryService(config_path)
        result = service.sync_repository("owner/repo")

        assert result["status"] == "error"
        assert "Git error" in result["message"]

    def test_sync_raises_for_unknown_repo(self, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)

        with pytest.raises(ValueError, match="not found"):
            service.sync_repository("nonexistent/repo")


# ============================================================================
# clone_repository
# ============================================================================


class TestCloneRepository:
    """Tests for cloning repositories."""

    @patch("app.services.repository_service.Repo")
    def test_clone_success(self, mock_repo_cls, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)
        local_path = tmp_path / "repos" / "owner" / "wiki"

        result = service.clone_repository(
            repo_id="owner/wiki",
            remote_url="https://github.com/owner/wiki.git",
            local_path=local_path,
            name="wiki",
            owner="owner",
        )

        mock_repo_cls.clone_from.assert_called_once_with(
            "https://github.com/owner/wiki.git", str(local_path)
        )
        assert result["id"] == "owner/wiki"
        assert result["name"] == "wiki"

    @patch("app.services.repository_service.Repo")
    def test_clone_injects_github_token(self, mock_repo_cls, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)
        local_path = tmp_path / "repos" / "owner" / "wiki"

        service.clone_repository(
            repo_id="owner/wiki",
            remote_url="https://github.com/owner/wiki.git",
            local_path=local_path,
            name="wiki",
            owner="owner",
            github_token="ghp_testtoken",
        )

        call_args = mock_repo_cls.clone_from.call_args
        clone_url = call_args[0][0]
        assert "ghp_testtoken@github.com" in clone_url

    @patch("app.services.repository_service.Repo")
    def test_clone_failure_raises(self, mock_repo_cls, tmp_path):
        config_path = tmp_path / "config" / "repositories.json"
        service = RepositoryService(config_path)
        local_path = tmp_path / "repos" / "owner" / "wiki"

        mock_repo_cls.clone_from.side_effect = GitCommandError("clone", "failed")

        with pytest.raises(GitCommandError):
            service.clone_repository(
                repo_id="owner/wiki",
                remote_url="https://github.com/owner/wiki.git",
                local_path=local_path,
                name="wiki",
                owner="owner",
            )

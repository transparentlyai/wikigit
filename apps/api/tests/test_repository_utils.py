"""Tests for multi-repository utility functions."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

# Patch repository_service before importing the module under test,
# since app.utils.repository_utils imports from app.services which
# eagerly loads settings at import time.
with patch("app.services.repository_service", new_callable=MagicMock):
    from app.utils.repository_utils import (
        check_repository_writable,
        get_repository_info,
        get_repository_path,
    )


# ============================================================================
# get_repository_path
# ============================================================================


class TestGetRepositoryPath:
    """Tests for get_repository_path function."""

    @patch("app.utils.repository_utils.repository_service")
    def test_returns_path_when_repo_found(self, mock_repo_service):
        mock_repo_service.get_repository.return_value = {
            "id": "org/wiki",
            "local_path": "/tmp/repos/org/wiki",
        }
        result = get_repository_path("org/wiki")
        assert isinstance(result, Path)
        assert result == Path("/tmp/repos/org/wiki")
        mock_repo_service.get_repository.assert_called_once_with("org/wiki")

    @patch("app.utils.repository_utils.repository_service")
    def test_raises_404_when_repo_not_found(self, mock_repo_service):
        mock_repo_service.get_repository.side_effect = ValueError(
            "Repository not found"
        )
        with pytest.raises(HTTPException) as exc_info:
            get_repository_path("nonexistent/repo")
        assert exc_info.value.status_code == 404
        assert "Repository not found" in exc_info.value.detail

    @patch("app.utils.repository_utils.repository_service")
    def test_returns_correct_path_type(self, mock_repo_service):
        mock_repo_service.get_repository.return_value = {
            "local_path": "/var/data/repos/test-org/test-repo",
        }
        result = get_repository_path("test-org/test-repo")
        assert isinstance(result, Path)
        assert str(result) == "/var/data/repos/test-org/test-repo"


# ============================================================================
# check_repository_writable
# ============================================================================


class TestCheckRepositoryWritable:
    """Tests for check_repository_writable function."""

    @patch("app.utils.repository_utils.repository_service")
    def test_passes_for_writable_repo(self, mock_repo_service):
        mock_repo_service.get_repository.return_value = {
            "id": "org/wiki",
            "read_only": False,
        }
        # Should not raise
        check_repository_writable("org/wiki")
        mock_repo_service.get_repository.assert_called_once_with("org/wiki")

    @patch("app.utils.repository_utils.repository_service")
    def test_passes_when_read_only_not_set(self, mock_repo_service):
        mock_repo_service.get_repository.return_value = {
            "id": "org/wiki",
        }
        # read_only not in dict, defaults to False via .get("read_only", False)
        check_repository_writable("org/wiki")

    @patch("app.utils.repository_utils.repository_service")
    def test_raises_403_for_read_only_repo(self, mock_repo_service):
        mock_repo_service.get_repository.return_value = {
            "id": "org/wiki",
            "read_only": True,
        }
        with pytest.raises(HTTPException) as exc_info:
            check_repository_writable("org/wiki")
        assert exc_info.value.status_code == 403
        assert "read-only" in exc_info.value.detail

    @patch("app.utils.repository_utils.repository_service")
    def test_raises_404_when_repo_not_found(self, mock_repo_service):
        mock_repo_service.get_repository.side_effect = ValueError(
            "Repository not found"
        )
        with pytest.raises(HTTPException) as exc_info:
            check_repository_writable("nonexistent/repo")
        assert exc_info.value.status_code == 404
        assert "Repository not found" in exc_info.value.detail


# ============================================================================
# get_repository_info
# ============================================================================


class TestGetRepositoryInfo:
    """Tests for get_repository_info function."""

    @patch("app.utils.repository_utils.repository_service")
    def test_returns_dict_when_found(self, mock_repo_service):
        repo_data = {
            "id": "org/wiki",
            "name": "wiki",
            "owner": "org",
            "local_path": "/tmp/repos/org/wiki",
            "read_only": False,
        }
        mock_repo_service.get_repository.return_value = repo_data
        result = get_repository_info("org/wiki")
        assert result == repo_data
        mock_repo_service.get_repository.assert_called_once_with("org/wiki")

    @patch("app.utils.repository_utils.repository_service")
    def test_raises_404_when_not_found(self, mock_repo_service):
        mock_repo_service.get_repository.side_effect = ValueError(
            "Repository not found"
        )
        with pytest.raises(HTTPException) as exc_info:
            get_repository_info("nonexistent/repo")
        assert exc_info.value.status_code == 404
        assert "Repository not found" in exc_info.value.detail

    @patch("app.utils.repository_utils.repository_service")
    def test_returns_exact_dict_from_service(self, mock_repo_service):
        """Verify the function returns the exact dict from repository_service."""
        expected = {
            "id": "test/repo",
            "name": "repo",
            "owner": "test",
            "remote_url": "https://github.com/test/repo.git",
            "local_path": "/repos/test/repo",
            "enabled": True,
            "read_only": False,
            "default_branch": "main",
        }
        mock_repo_service.get_repository.return_value = expected
        result = get_repository_info("test/repo")
        assert result is expected  # same object reference

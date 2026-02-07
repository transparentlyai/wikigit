"""Shared test fixtures for WikiGit API tests."""

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest


@pytest.fixture
def tmp_dir(tmp_path):
    """Provide a temporary directory."""
    return tmp_path


@pytest.fixture
def mock_settings():
    """Create mock settings object matching the real Settings structure."""
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
def sample_repo_metadata():
    """Sample repository metadata dict."""
    return {
        "id": "owner/test-repo",
        "name": "test-repo",
        "owner": "owner",
        "remote_url": "https://github.com/owner/test-repo.git",
        "local_path": "/tmp/repos/owner/test-repo",
        "enabled": True,
        "read_only": False,
        "default_branch": "main",
        "last_synced": None,
        "sync_status": "never",
        "error_message": None,
    }


@pytest.fixture
def repos_config_file(tmp_path, sample_repo_metadata):
    """Create a temporary repositories config JSON file."""
    config_path = tmp_path / "config" / "repositories.json"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    data = {"repositories": {"owner/test-repo": sample_repo_metadata}}
    config_path.write_text(json.dumps(data))
    return config_path

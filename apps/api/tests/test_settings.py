"""Tests for configuration settings classes and helpers.

Target: app/config/settings.py
Tier 2: Individual model classes and expand_env_vars tested directly.

NOTE: Importing from app.config.settings executes the module-level
`settings = get_settings()` call.  This succeeds because the project has
a valid config.yaml at the repository root.  We test the individual
pydantic model classes and the expand_env_vars helper without needing to
mock that singleton.
"""

from datetime import datetime
from pathlib import Path

import pytest

from app.config.settings import (
    AppSettings,
    GitHubSettings,
    MultiRepositorySettings,
    RepositoryConfig,
    SearchSettings,
    Settings,
    expand_env_vars,
)


# ---------------------------------------------------------------------------
# expand_env_vars
# ---------------------------------------------------------------------------


class TestExpandEnvVars:
    """Tests for the expand_env_vars helper function."""

    def test_substitutes_known_var(self, monkeypatch):
        """${VAR} is replaced by the corresponding environment variable value."""
        monkeypatch.setenv("MY_TEST_VAR", "/some/path")
        assert expand_env_vars("${MY_TEST_VAR}/subdir") == "/some/path/subdir"

    def test_leaves_unknown_var_unchanged(self, monkeypatch):
        """${UNKNOWN} stays literal when the env var is not set."""
        monkeypatch.delenv("TOTALLY_UNKNOWN_VAR_XYZ", raising=False)
        assert (
            expand_env_vars("${TOTALLY_UNKNOWN_VAR_XYZ}")
            == "${TOTALLY_UNKNOWN_VAR_XYZ}"
        )

    def test_no_vars_returns_unchanged(self):
        """A plain string without ${} patterns is returned as-is."""
        assert expand_env_vars("/plain/path") == "/plain/path"

    def test_multiple_vars(self, monkeypatch):
        """Multiple ${VAR} patterns are all expanded."""
        monkeypatch.setenv("A_VAR", "alpha")
        monkeypatch.setenv("B_VAR", "beta")
        result = expand_env_vars("${A_VAR}-${B_VAR}")
        assert result == "alpha-beta"

    def test_empty_string(self):
        """Empty string returns empty string."""
        assert expand_env_vars("") == ""


# ---------------------------------------------------------------------------
# AppSettings
# ---------------------------------------------------------------------------


class TestAppSettings:
    """Tests for the AppSettings model."""

    def test_defaults(self):
        """Default values match expected application defaults."""
        s = AppSettings()
        assert s.name == "WikiGit"
        assert s.description == "Git-based Wiki Application"
        assert s.domain == "localhost:3003"
        assert s.max_file_size_mb == 10
        assert s.admins == []
        assert s.home_page_repository is None
        assert s.home_page_article is None

    def test_max_file_size_bytes_property(self):
        """max_file_size_bytes converts MB to bytes correctly."""
        s = AppSettings(max_file_size_mb=5)
        assert s.max_file_size_bytes == 5 * 1024 * 1024

    def test_max_file_size_bytes_default(self):
        """Default 10 MB yields 10485760 bytes."""
        s = AppSettings()
        assert s.max_file_size_bytes == 10 * 1024 * 1024

    def test_custom_values(self):
        """Custom values are accepted and stored."""
        s = AppSettings(
            name="Custom Wiki",
            max_file_size_mb=50,
            admins=["admin@test.com"],
        )
        assert s.name == "Custom Wiki"
        assert s.max_file_size_mb == 50
        assert s.admins == ["admin@test.com"]


# ---------------------------------------------------------------------------
# SearchSettings
# ---------------------------------------------------------------------------


class TestSearchSettings:
    """Tests for the SearchSettings model."""

    def test_default_index_path(self):
        """Default index_path is ./data/whoosh_index."""
        s = SearchSettings()
        assert s.index_path == "./data/whoosh_index"

    def test_index_dir_property_returns_path(self):
        """index_dir property returns a resolved Path object."""
        s = SearchSettings(index_path="/tmp/test-idx")
        assert isinstance(s.index_dir, Path)
        assert s.index_dir == Path("/tmp/test-idx").resolve()

    def test_expand_path_env_vars_validator(self, monkeypatch):
        """The field validator expands ${VAR} in index_path."""
        monkeypatch.setenv("IDX_ROOT", "/data/indexes")
        s = SearchSettings(index_path="${IDX_ROOT}/whoosh")
        assert s.index_path == "/data/indexes/whoosh"

    def test_rebuild_on_startup_default(self):
        """rebuild_on_startup defaults to True."""
        s = SearchSettings()
        assert s.rebuild_on_startup is True


# ---------------------------------------------------------------------------
# GitHubSettings
# ---------------------------------------------------------------------------


class TestGitHubSettings:
    """Tests for the GitHubSettings model."""

    def test_token_reads_env_var(self, monkeypatch):
        """token property reads from the configured env var name."""
        monkeypatch.setenv("MY_GH_TOKEN", "ghp_abc123")
        s = GitHubSettings(token_env_var="MY_GH_TOKEN", user_id="testuser")
        assert s.token == "ghp_abc123"

    def test_token_returns_none_when_unset(self, monkeypatch):
        """token property returns None when the env var is not set."""
        monkeypatch.delenv("GITHUB_TOKEN", raising=False)
        s = GitHubSettings(user_id="testuser")
        assert s.token is None

    def test_default_token_env_var(self):
        """Default token_env_var is GITHUB_TOKEN."""
        s = GitHubSettings(user_id="testuser")
        assert s.token_env_var == "GITHUB_TOKEN"

    def test_user_id_required(self):
        """user_id is a required field."""
        with pytest.raises(Exception):
            GitHubSettings()


# ---------------------------------------------------------------------------
# RepositoryConfig
# ---------------------------------------------------------------------------


class TestRepositoryConfig:
    """Tests for the RepositoryConfig model."""

    def test_construction_with_required_fields(self):
        """Can construct with all required fields."""
        rc = RepositoryConfig(
            id="owner/repo",
            name="repo",
            owner="owner",
            remote_url="https://github.com/owner/repo.git",
            local_path="/tmp/repos/owner/repo",
        )
        assert rc.id == "owner/repo"
        assert rc.name == "repo"
        assert rc.owner == "owner"
        assert rc.remote_url == "https://github.com/owner/repo.git"
        assert rc.local_path == "/tmp/repos/owner/repo"

    def test_defaults(self):
        """Default values for optional fields are correct."""
        rc = RepositoryConfig(
            id="o/r",
            name="r",
            owner="o",
            remote_url="https://x.com/o/r.git",
            local_path="/tmp/o/r",
        )
        assert rc.enabled is True
        assert rc.read_only is True
        assert rc.default_branch == "main"
        assert rc.last_synced is None
        assert rc.sync_status == "never"
        assert rc.error_message is None

    def test_sync_status_literal_valid_values(self):
        """All valid sync_status values are accepted."""
        for status in ("synced", "pending", "error", "never", "unavailable"):
            rc = RepositoryConfig(
                id="o/r",
                name="r",
                owner="o",
                remote_url="https://x.com/o/r.git",
                local_path="/tmp/o/r",
                sync_status=status,
            )
            assert rc.sync_status == status

    def test_sync_status_invalid_value_raises(self):
        """An invalid sync_status value raises a validation error."""
        with pytest.raises(Exception):
            RepositoryConfig(
                id="o/r",
                name="r",
                owner="o",
                remote_url="https://x.com/o/r.git",
                local_path="/tmp/o/r",
                sync_status="bogus",
            )

    def test_last_synced_accepts_datetime(self):
        """last_synced can be set to a datetime."""
        now = datetime.now()
        rc = RepositoryConfig(
            id="o/r",
            name="r",
            owner="o",
            remote_url="https://x.com/o/r.git",
            local_path="/tmp/o/r",
            last_synced=now,
        )
        assert rc.last_synced == now


# ---------------------------------------------------------------------------
# MultiRepositorySettings
# ---------------------------------------------------------------------------


class TestMultiRepositorySettings:
    """Tests for the MultiRepositorySettings model."""

    def test_defaults(self):
        """Default values match expected multi-repo defaults."""
        s = MultiRepositorySettings()
        assert s.enabled is True
        assert s.repositories_root_dir == "./wiki-repositories"
        assert s.auto_sync_interval_minutes == 15
        assert s.author_name == "WikiGit Bot"
        assert s.author_email == "bot@wikigit.app"
        assert s.default_branch == "main"
        assert s.github is None

    def test_root_dir_property_returns_path(self):
        """root_dir property returns a resolved Path object."""
        s = MultiRepositorySettings(repositories_root_dir="/tmp/repos")
        assert isinstance(s.root_dir, Path)
        assert s.root_dir == Path("/tmp/repos").resolve()

    def test_expand_path_env_vars_in_root_dir(self, monkeypatch):
        """The field validator expands ${VAR} in repositories_root_dir."""
        monkeypatch.setenv("REPO_BASE", "/data/wiki")
        s = MultiRepositorySettings(repositories_root_dir="${REPO_BASE}/repos")
        assert s.repositories_root_dir == "/data/wiki/repos"

    def test_github_nested_settings(self):
        """GitHub settings can be nested inside MultiRepositorySettings."""
        s = MultiRepositorySettings(github=GitHubSettings(user_id="myuser"))
        assert s.github is not None
        assert s.github.user_id == "myuser"


# ---------------------------------------------------------------------------
# Settings.is_admin
# ---------------------------------------------------------------------------


class TestSettingsIsAdmin:
    """Tests for Settings.is_admin method.

    We test this via the module-level singleton that loads from config.yaml.
    """

    def test_is_admin_with_known_admin(self):
        """is_admin returns True for a configured admin email."""
        from app.config.settings import settings

        if settings.app.admins:
            assert settings.is_admin(settings.app.admins[0]) is True

    def test_is_admin_with_unknown_email(self):
        """is_admin returns False for an email not in the admin list."""
        from app.config.settings import settings

        assert settings.is_admin("nobody@nowhere.invalid") is False

    def test_is_admin_on_fresh_instance(self):
        """is_admin works on a directly-constructed Settings with admins."""
        # Construct a minimal Settings (uses defaults, ignoring yaml_file)
        s = Settings(app=AppSettings(admins=["root@admin.com"]))
        assert s.is_admin("root@admin.com") is True
        assert s.is_admin("other@user.com") is False

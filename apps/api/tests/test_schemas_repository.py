"""Tests for repository, sync, and GitHub Pydantic models."""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.models.schemas.repository import (
    GitHubRepository,
    GitHubScanResponse,
    RepositoryCreate,
    RepositoryListResponse,
    RepositoryMetadata,
    RepositoryStatus,
    RepositorySyncResponse,
    RepositoryUpdate,
    SyncResult,
)


# ============================================================================
# RepositoryMetadata
# ============================================================================


class TestRepositoryMetadata:
    """Tests for RepositoryMetadata model."""

    def test_construction_with_required_fields(self):
        repo = RepositoryMetadata(
            id="org/wiki",
            name="wiki",
            owner="org",
            remote_url="https://github.com/org/wiki.git",
        )
        assert repo.id == "org/wiki"
        assert repo.name == "wiki"
        assert repo.owner == "org"
        assert repo.remote_url == "https://github.com/org/wiki.git"

    def test_default_values(self):
        repo = RepositoryMetadata(
            id="org/wiki",
            name="wiki",
            owner="org",
            remote_url="https://github.com/org/wiki.git",
        )
        assert repo.enabled is True
        assert repo.read_only is False
        assert repo.default_branch == "main"
        assert repo.last_synced is None
        assert repo.sync_status == "never"
        assert repo.error_message is None

    def test_all_sync_status_values(self):
        valid_statuses = ["synced", "pending", "error", "never", "unavailable"]
        for status_val in valid_statuses:
            repo = RepositoryMetadata(
                id="org/wiki",
                name="wiki",
                owner="org",
                remote_url="https://github.com/org/wiki.git",
                sync_status=status_val,
            )
            assert repo.sync_status == status_val

    def test_invalid_sync_status_rejected(self):
        with pytest.raises(ValidationError):
            RepositoryMetadata(
                id="org/wiki",
                name="wiki",
                owner="org",
                remote_url="https://github.com/org/wiki.git",
                sync_status="unknown",
            )

    def test_with_last_synced(self):
        now = datetime.now(timezone.utc)
        repo = RepositoryMetadata(
            id="org/wiki",
            name="wiki",
            owner="org",
            remote_url="https://github.com/org/wiki.git",
            last_synced=now,
            sync_status="synced",
        )
        assert repo.last_synced == now
        assert repo.sync_status == "synced"

    def test_with_error_message(self):
        repo = RepositoryMetadata(
            id="org/wiki",
            name="wiki",
            owner="org",
            remote_url="https://github.com/org/wiki.git",
            sync_status="error",
            error_message="Connection refused",
        )
        assert repo.error_message == "Connection refused"

    def test_serialization_round_trip(self):
        repo = RepositoryMetadata(
            id="org/wiki",
            name="wiki",
            owner="org",
            remote_url="https://github.com/org/wiki.git",
        )
        data = repo.model_dump()
        restored = RepositoryMetadata(**data)
        assert restored == repo

    def test_json_serialization(self):
        repo = RepositoryMetadata(
            id="org/wiki",
            name="wiki",
            owner="org",
            remote_url="https://github.com/org/wiki.git",
        )
        json_str = repo.model_dump_json()
        restored = RepositoryMetadata.model_validate_json(json_str)
        assert restored == repo

    def test_missing_required_fields(self):
        with pytest.raises(ValidationError):
            RepositoryMetadata(id="org/wiki")


# ============================================================================
# RepositoryCreate
# ============================================================================


class TestRepositoryCreate:
    """Tests for RepositoryCreate validation."""

    def test_valid_https_url(self):
        rc = RepositoryCreate(remote_url="https://github.com/org/repo.git")
        assert rc.remote_url == "https://github.com/org/repo.git"

    def test_valid_ssh_url(self):
        rc = RepositoryCreate(remote_url="git@github.com:org/repo.git")
        assert rc.remote_url == "git@github.com:org/repo.git"

    def test_invalid_url_non_github(self):
        with pytest.raises(ValidationError, match="Only GitHub repository URLs"):
            RepositoryCreate(remote_url="https://gitlab.com/org/repo.git")

    def test_invalid_url_no_scheme(self):
        with pytest.raises(ValidationError, match="Only GitHub repository URLs"):
            RepositoryCreate(remote_url="github.com/org/repo.git")

    def test_invalid_url_random_string(self):
        with pytest.raises(ValidationError, match="Only GitHub repository URLs"):
            RepositoryCreate(remote_url="not-a-url")

    def test_default_values(self):
        rc = RepositoryCreate(remote_url="https://github.com/org/repo.git")
        assert rc.name is None
        assert rc.enabled is True
        assert rc.read_only is False

    def test_with_custom_name(self):
        rc = RepositoryCreate(
            remote_url="https://github.com/org/repo.git",
            name="My Docs",
        )
        assert rc.name == "My Docs"

    def test_with_read_only(self):
        rc = RepositoryCreate(
            remote_url="https://github.com/org/repo.git",
            read_only=True,
        )
        assert rc.read_only is True

    def test_with_disabled(self):
        rc = RepositoryCreate(
            remote_url="https://github.com/org/repo.git",
            enabled=False,
        )
        assert rc.enabled is False

    def test_missing_remote_url_rejected(self):
        with pytest.raises(ValidationError):
            RepositoryCreate()


# ============================================================================
# RepositoryUpdate
# ============================================================================


class TestRepositoryUpdate:
    """Tests for RepositoryUpdate model."""

    def test_all_fields_optional(self):
        ru = RepositoryUpdate()
        assert ru.name is None
        assert ru.enabled is None
        assert ru.read_only is None

    def test_partial_update_name_only(self):
        ru = RepositoryUpdate(name="New Name")
        assert ru.name == "New Name"
        assert ru.enabled is None
        assert ru.read_only is None

    def test_partial_update_enabled_only(self):
        ru = RepositoryUpdate(enabled=False)
        assert ru.enabled is False

    def test_partial_update_read_only_only(self):
        ru = RepositoryUpdate(read_only=True)
        assert ru.read_only is True

    def test_full_update(self):
        ru = RepositoryUpdate(name="Updated", enabled=True, read_only=False)
        assert ru.name == "Updated"
        assert ru.enabled is True
        assert ru.read_only is False


# ============================================================================
# GitHubRepository
# ============================================================================


class TestGitHubRepository:
    """Tests for GitHubRepository model."""

    def test_construction(self):
        gh = GitHubRepository(
            full_name="org/docs",
            name="docs",
            clone_url="https://github.com/org/docs.git",
            private=True,
        )
        assert gh.full_name == "org/docs"
        assert gh.name == "docs"
        assert gh.clone_url == "https://github.com/org/docs.git"
        assert gh.private is True
        assert gh.description is None

    def test_with_description(self):
        gh = GitHubRepository(
            full_name="org/docs",
            name="docs",
            clone_url="https://github.com/org/docs.git",
            private=False,
            description="Documentation repository",
        )
        assert gh.description == "Documentation repository"

    def test_missing_required_field_rejected(self):
        with pytest.raises(ValidationError):
            GitHubRepository(full_name="org/docs", name="docs")


# ============================================================================
# GitHubScanResponse
# ============================================================================


class TestGitHubScanResponse:
    """Tests for GitHubScanResponse model."""

    def test_empty_scan(self):
        resp = GitHubScanResponse(repositories=[], total=0)
        assert resp.repositories == []
        assert resp.total == 0

    def test_with_repositories(self):
        repo = GitHubRepository(
            full_name="org/docs",
            name="docs",
            clone_url="https://github.com/org/docs.git",
            private=False,
        )
        resp = GitHubScanResponse(repositories=[repo], total=1)
        assert len(resp.repositories) == 1

    def test_negative_total_rejected(self):
        with pytest.raises(ValidationError):
            GitHubScanResponse(repositories=[], total=-1)


# ============================================================================
# RepositoryStatus
# ============================================================================


class TestRepositoryStatus:
    """Tests for RepositoryStatus model."""

    def test_construction_with_required_fields(self):
        rs = RepositoryStatus(
            id="wiki-main",
            name="Main Wiki",
            owner="org",
            remote_url="https://github.com/org/wiki.git",
            enabled=True,
            read_only=False,
            default_branch="main",
            last_synced=None,
            sync_status="never",
        )
        assert rs.id == "wiki-main"
        assert rs.name == "Main Wiki"
        assert rs.error_message is None
        assert rs.local_path is None
        assert rs.has_local_changes is False
        assert rs.ahead_of_remote == 0
        assert rs.behind_of_remote == 0

    def test_all_sync_statuses(self):
        for status_val in ["synced", "pending", "error", "never", "unavailable"]:
            rs = RepositoryStatus(
                id="wiki",
                name="Wiki",
                owner="org",
                remote_url="https://github.com/org/wiki.git",
                enabled=True,
                read_only=False,
                default_branch="main",
                last_synced=None,
                sync_status=status_val,
            )
            assert rs.sync_status == status_val

    def test_invalid_sync_status_rejected(self):
        with pytest.raises(ValidationError):
            RepositoryStatus(
                id="wiki",
                name="Wiki",
                owner="org",
                remote_url="https://github.com/org/wiki.git",
                enabled=True,
                read_only=False,
                default_branch="main",
                last_synced=None,
                sync_status="invalid",
            )

    def test_with_local_changes(self):
        rs = RepositoryStatus(
            id="wiki",
            name="Wiki",
            owner="org",
            remote_url="https://github.com/org/wiki.git",
            enabled=True,
            read_only=False,
            default_branch="main",
            last_synced=None,
            sync_status="synced",
            has_local_changes=True,
            ahead_of_remote=3,
            behind_of_remote=1,
        )
        assert rs.has_local_changes is True
        assert rs.ahead_of_remote == 3
        assert rs.behind_of_remote == 1


# ============================================================================
# RepositoryListResponse
# ============================================================================


class TestRepositoryListResponse:
    """Tests for RepositoryListResponse model."""

    def test_construction(self):
        status = RepositoryStatus(
            id="wiki",
            name="Wiki",
            owner="org",
            remote_url="https://github.com/org/wiki.git",
            enabled=True,
            read_only=False,
            default_branch="main",
            last_synced=None,
            sync_status="never",
        )
        resp = RepositoryListResponse(repositories=[status], total=1)
        assert len(resp.repositories) == 1
        assert resp.total == 1

    def test_negative_total_rejected(self):
        with pytest.raises(ValidationError):
            RepositoryListResponse(repositories=[], total=-1)


# ============================================================================
# RepositorySyncResponse
# ============================================================================


class TestRepositorySyncResponse:
    """Tests for RepositorySyncResponse model."""

    def test_success_response(self):
        resp = RepositorySyncResponse(
            repository_id="wiki-main",
            status="success",
            message="Synced successfully",
        )
        assert resp.repository_id == "wiki-main"
        assert resp.status == "success"
        assert resp.commits_pulled == 0
        assert resp.commits_pushed == 0
        assert resp.files_changed == 0

    def test_error_response(self):
        resp = RepositorySyncResponse(
            repository_id="wiki-main",
            status="error",
            message="Connection failed",
        )
        assert resp.status == "error"

    def test_with_counts(self):
        resp = RepositorySyncResponse(
            repository_id="wiki-main",
            status="success",
            message="Done",
            commits_pulled=5,
            commits_pushed=2,
            files_changed=10,
        )
        assert resp.commits_pulled == 5
        assert resp.commits_pushed == 2
        assert resp.files_changed == 10

    def test_invalid_status_rejected(self):
        with pytest.raises(ValidationError):
            RepositorySyncResponse(
                repository_id="wiki",
                status="partial",
                message="msg",
            )


# ============================================================================
# SyncResult
# ============================================================================


class TestSyncResult:
    """Tests for SyncResult model."""

    def test_success_result(self):
        sr = SyncResult(
            repository_id="wiki-main",
            status="success",
            message="Synced",
        )
        assert sr.repository_id == "wiki-main"
        assert sr.status == "success"
        assert sr.files_changed is None
        assert sr.reindexed is False

    def test_with_all_fields(self):
        sr = SyncResult(
            repository_id="wiki-main",
            status="success",
            message="Done",
            files_changed=3,
            reindexed=True,
        )
        assert sr.files_changed == 3
        assert sr.reindexed is True

    def test_error_result(self):
        sr = SyncResult(
            repository_id="wiki",
            status="error",
            message="Failed to pull",
        )
        assert sr.status == "error"

    def test_invalid_status_rejected(self):
        with pytest.raises(ValidationError):
            SyncResult(
                repository_id="wiki",
                status="warning",
                message="msg",
            )

    def test_serialization_round_trip(self):
        sr = SyncResult(
            repository_id="wiki",
            status="success",
            message="OK",
            files_changed=1,
            reindexed=True,
        )
        data = sr.model_dump()
        restored = SyncResult(**data)
        assert restored == sr

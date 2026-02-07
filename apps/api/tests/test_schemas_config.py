"""Tests for configuration, health, media, error, and user Pydantic models."""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.models.schemas.config import (
    AppConfig,
    ConfigData,
    ConfigResponse,
    ConfigUpdate,
    ErrorDetail,
    ErrorResponse,
    HealthCheck,
    MediaFile,
    MediaListResponse,
    MultiRepositoryConfig,
    SearchConfig,
    User,
)


# ============================================================================
# AppConfig
# ============================================================================


class TestAppConfig:
    """Tests for AppConfig model."""

    def test_all_fields_optional(self):
        config = AppConfig()
        assert config.name is None
        assert config.description is None
        assert config.domain is None
        assert config.max_file_size_mb is None
        assert config.admins is None
        assert config.home_page_repository is None
        assert config.home_page_article is None

    def test_with_all_fields(self):
        config = AppConfig(
            name="WikiGit",
            description="Git Wiki",
            domain="wiki.example.com",
            max_file_size_mb=10,
            admins=["admin@example.com"],
            home_page_repository="org/wiki",
            home_page_article="home.md",
        )
        assert config.name == "WikiGit"
        assert config.max_file_size_mb == 10
        assert config.admins == ["admin@example.com"]

    def test_max_file_size_minimum(self):
        config = AppConfig(max_file_size_mb=1)
        assert config.max_file_size_mb == 1

    def test_max_file_size_maximum(self):
        config = AppConfig(max_file_size_mb=100)
        assert config.max_file_size_mb == 100

    def test_max_file_size_below_minimum_rejected(self):
        with pytest.raises(ValidationError):
            AppConfig(max_file_size_mb=0)

    def test_max_file_size_above_maximum_rejected(self):
        with pytest.raises(ValidationError):
            AppConfig(max_file_size_mb=101)


# ============================================================================
# SearchConfig
# ============================================================================


class TestSearchConfig:
    """Tests for SearchConfig model."""

    def test_all_fields_optional(self):
        config = SearchConfig()
        assert config.index_path is None
        assert config.rebuild_on_startup is None

    def test_with_values(self):
        config = SearchConfig(
            index_path="/path/to/index",
            rebuild_on_startup=True,
        )
        assert config.index_path == "/path/to/index"
        assert config.rebuild_on_startup is True


# ============================================================================
# MultiRepositoryConfig
# ============================================================================


class TestMultiRepositoryConfig:
    """Tests for MultiRepositoryConfig model."""

    def test_all_fields_optional(self):
        config = MultiRepositoryConfig()
        assert config.auto_sync_interval_minutes is None
        assert config.author_name is None
        assert config.author_email is None
        assert config.default_branch is None
        assert config.repositories_root_dir is None

    def test_with_all_fields(self):
        config = MultiRepositoryConfig(
            auto_sync_interval_minutes=15,
            author_name="Bot",
            author_email="bot@example.com",
            default_branch="main",
            repositories_root_dir="/repos",
        )
        assert config.auto_sync_interval_minutes == 15
        assert config.author_name == "Bot"

    def test_auto_sync_interval_minimum(self):
        config = MultiRepositoryConfig(auto_sync_interval_minutes=1)
        assert config.auto_sync_interval_minutes == 1

    def test_auto_sync_interval_maximum(self):
        config = MultiRepositoryConfig(auto_sync_interval_minutes=1440)
        assert config.auto_sync_interval_minutes == 1440

    def test_auto_sync_interval_below_minimum_rejected(self):
        with pytest.raises(ValidationError):
            MultiRepositoryConfig(auto_sync_interval_minutes=0)

    def test_auto_sync_interval_above_maximum_rejected(self):
        with pytest.raises(ValidationError):
            MultiRepositoryConfig(auto_sync_interval_minutes=1441)


# ============================================================================
# ConfigUpdate
# ============================================================================


class TestConfigUpdate:
    """Tests for ConfigUpdate model."""

    def test_all_fields_optional(self):
        update = ConfigUpdate()
        assert update.app is None
        assert update.search is None
        assert update.multi_repository is None

    def test_partial_update_app_only(self):
        update = ConfigUpdate(app=AppConfig(name="New Name"))
        assert update.app.name == "New Name"
        assert update.search is None
        assert update.multi_repository is None

    def test_partial_update_search_only(self):
        update = ConfigUpdate(search=SearchConfig(rebuild_on_startup=False))
        assert update.search.rebuild_on_startup is False
        assert update.app is None

    def test_partial_update_multi_repository_only(self):
        update = ConfigUpdate(multi_repository=MultiRepositoryConfig(author_name="Bot"))
        assert update.multi_repository.author_name == "Bot"

    def test_full_update(self):
        update = ConfigUpdate(
            app=AppConfig(name="Wiki"),
            search=SearchConfig(index_path="/idx"),
            multi_repository=MultiRepositoryConfig(default_branch="develop"),
        )
        assert update.app.name == "Wiki"
        assert update.search.index_path == "/idx"
        assert update.multi_repository.default_branch == "develop"

    def test_nested_partial_fields(self):
        """ConfigUpdate with partial nested object: only some fields set."""
        update = ConfigUpdate(app=AppConfig(name="Wiki"))
        assert update.app.name == "Wiki"
        assert update.app.description is None
        assert update.app.domain is None


# ============================================================================
# ConfigData
# ============================================================================


class TestConfigData:
    """Tests for ConfigData model."""

    def test_construction_with_required_fields(self):
        data = ConfigData(
            app_name="WikiGit",
            admins=["admin@example.com"],
            index_dir="/tmp/index",
            auto_sync_interval_minutes=15,
            author_name="Bot",
            author_email="bot@example.com",
            default_branch="main",
            repositories_root_dir="/repos",
        )
        assert data.app_name == "WikiGit"
        assert data.admins == ["admin@example.com"]
        assert data.index_dir == "/tmp/index"
        assert data.auto_sync_interval_minutes == 15
        assert data.author_name == "Bot"
        assert data.author_email == "bot@example.com"
        assert data.default_branch == "main"
        assert data.repositories_root_dir == "/repos"

    def test_optional_fields_default_to_none(self):
        data = ConfigData(
            app_name="WikiGit",
            admins=[],
            index_dir="/idx",
            auto_sync_interval_minutes=15,
            author_name="Bot",
            author_email="bot@example.com",
            default_branch="main",
            repositories_root_dir="/repos",
        )
        assert data.home_page_repository is None
        assert data.home_page_article is None

    def test_with_home_page_fields(self):
        data = ConfigData(
            app_name="WikiGit",
            admins=[],
            index_dir="/idx",
            auto_sync_interval_minutes=15,
            author_name="Bot",
            author_email="bot@example.com",
            default_branch="main",
            repositories_root_dir="/repos",
            home_page_repository="org/wiki",
            home_page_article="home.md",
        )
        assert data.home_page_repository == "org/wiki"
        assert data.home_page_article == "home.md"

    def test_missing_required_field_rejected(self):
        with pytest.raises(ValidationError):
            ConfigData(app_name="WikiGit")

    def test_empty_admins_list_allowed(self):
        data = ConfigData(
            app_name="WikiGit",
            admins=[],
            index_dir="/idx",
            auto_sync_interval_minutes=15,
            author_name="Bot",
            author_email="bot@example.com",
            default_branch="main",
            repositories_root_dir="/repos",
        )
        assert data.admins == []


# ============================================================================
# ConfigResponse
# ============================================================================


class TestConfigResponse:
    """Tests for ConfigResponse model."""

    def test_construction(self):
        resp = ConfigResponse(
            app=AppConfig(name="Wiki"),
            search=SearchConfig(index_path="/idx"),
        )
        assert resp.app.name == "Wiki"
        assert resp.search.index_path == "/idx"

    def test_missing_required_fields_rejected(self):
        with pytest.raises(ValidationError):
            ConfigResponse(app=AppConfig())


# ============================================================================
# HealthCheck
# ============================================================================


class TestHealthCheck:
    """Tests for HealthCheck model."""

    def test_healthy_status(self):
        hc = HealthCheck(status="healthy", version="1.0.0")
        assert hc.status == "healthy"
        assert hc.version == "1.0.0"
        assert hc.timestamp is not None

    def test_unhealthy_status(self):
        hc = HealthCheck(status="unhealthy", version="1.0.0")
        assert hc.status == "unhealthy"

    def test_invalid_status_rejected(self):
        with pytest.raises(ValidationError):
            HealthCheck(status="degraded", version="1.0.0")

    def test_timestamp_auto_generated(self):
        before = datetime.now(timezone.utc)
        hc = HealthCheck(status="healthy", version="1.0.0")
        after = datetime.now(timezone.utc)
        assert before <= hc.timestamp <= after

    def test_custom_timestamp(self):
        ts = datetime(2025, 1, 1, tzinfo=timezone.utc)
        hc = HealthCheck(status="healthy", version="1.0.0", timestamp=ts)
        assert hc.timestamp == ts

    def test_missing_version_rejected(self):
        with pytest.raises(ValidationError):
            HealthCheck(status="healthy")

    def test_serialization(self):
        hc = HealthCheck(status="healthy", version="1.0.0")
        data = hc.model_dump()
        assert data["status"] == "healthy"
        assert data["version"] == "1.0.0"
        assert "timestamp" in data


# ============================================================================
# MediaFile
# ============================================================================


class TestMediaFile:
    """Tests for MediaFile model."""

    def test_construction(self):
        mf = MediaFile(
            filename="image.png",
            path="media/image.png",
            size=12345,
            content_type="image/png",
            url="/media/image.png",
        )
        assert mf.filename == "image.png"
        assert mf.path == "media/image.png"
        assert mf.size == 12345
        assert mf.content_type == "image/png"
        assert mf.url == "/media/image.png"

    def test_size_zero_allowed(self):
        mf = MediaFile(
            filename="empty.txt",
            path="media/empty.txt",
            size=0,
            content_type="text/plain",
            url="/media/empty.txt",
        )
        assert mf.size == 0

    def test_negative_size_rejected(self):
        with pytest.raises(ValidationError):
            MediaFile(
                filename="bad.txt",
                path="media/bad.txt",
                size=-1,
                content_type="text/plain",
                url="/media/bad.txt",
            )

    def test_missing_required_field_rejected(self):
        with pytest.raises(ValidationError):
            MediaFile(filename="test.png", path="media/test.png")

    def test_serialization_round_trip(self):
        mf = MediaFile(
            filename="doc.pdf",
            path="media/doc.pdf",
            size=99999,
            content_type="application/pdf",
            url="/media/doc.pdf",
        )
        data = mf.model_dump()
        restored = MediaFile(**data)
        assert restored == mf


# ============================================================================
# MediaListResponse
# ============================================================================


class TestMediaListResponse:
    """Tests for MediaListResponse model."""

    def test_with_files(self):
        files = [
            MediaFile(
                filename="a.png",
                path="media/a.png",
                size=100,
                content_type="image/png",
                url="/media/a.png",
            ),
        ]
        resp = MediaListResponse(files=files)
        assert len(resp.files) == 1

    def test_missing_files_rejected(self):
        with pytest.raises(ValidationError):
            MediaListResponse()


# ============================================================================
# ErrorDetail
# ============================================================================


class TestErrorDetail:
    """Tests for ErrorDetail model."""

    def test_with_message_only(self):
        err = ErrorDetail(message="Something went wrong")
        assert err.message == "Something went wrong"
        assert err.field is None
        assert err.type is None

    def test_with_all_fields(self):
        err = ErrorDetail(
            field="path",
            message="Invalid path",
            type="value_error",
        )
        assert err.field == "path"
        assert err.message == "Invalid path"
        assert err.type == "value_error"

    def test_missing_message_rejected(self):
        with pytest.raises(ValidationError):
            ErrorDetail()


# ============================================================================
# ErrorResponse
# ============================================================================


class TestErrorResponse:
    """Tests for ErrorResponse model."""

    def test_with_detail_only(self):
        resp = ErrorResponse(detail="Not found")
        assert resp.detail == "Not found"
        assert resp.errors is None

    def test_with_errors(self):
        errors = [ErrorDetail(message="bad field", field="path")]
        resp = ErrorResponse(detail="Validation error", errors=errors)
        assert len(resp.errors) == 1
        assert resp.errors[0].field == "path"

    def test_missing_detail_rejected(self):
        with pytest.raises(ValidationError):
            ErrorResponse()


# ============================================================================
# User
# ============================================================================


class TestUser:
    """Tests for User model."""

    def test_construction_with_email(self):
        user = User(email="user@example.com")
        assert user.email == "user@example.com"

    def test_is_admin_defaults_to_false(self):
        user = User(email="user@example.com")
        assert user.is_admin is False

    def test_is_admin_set_to_true(self):
        user = User(email="admin@example.com", is_admin=True)
        assert user.is_admin is True

    def test_missing_email_rejected(self):
        with pytest.raises(ValidationError):
            User()

    def test_serialization_round_trip(self):
        user = User(email="user@example.com", is_admin=True)
        data = user.model_dump()
        restored = User(**data)
        assert restored == user

    def test_json_serialization(self):
        user = User(email="test@example.com")
        json_str = user.model_dump_json()
        restored = User.model_validate_json(json_str)
        assert restored == user

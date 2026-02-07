"""Tests for article_helpers shared utility functions.

Target: app/routers/article_helpers.py
Tier 2: Module imports settings and repository_service at module level,
        so we patch those references before exercising the helpers.
"""

from unittest.mock import patch

import pytest
from fastapi import HTTPException

# The module under test imports settings and services at module level.
# Because config.yaml exists in the project root, the import succeeds
# without extra mocking.  We patch repository_service on the already-
# imported module namespace for individual tests.
from app.routers.article_helpers import (
    BINARY_EXTENSIONS,
    get_repository_path,
    normalize_author_field,
    validate_path,
)


# ---------------------------------------------------------------------------
# validate_path
# ---------------------------------------------------------------------------


class TestValidatePath:
    """Tests for the validate_path helper."""

    def test_normal_path_returned(self):
        """A normal relative path is returned unchanged."""
        assert validate_path("docs/readme.md") == "docs/readme.md"

    def test_url_encoded_characters_decoded(self):
        """URL-encoded characters (%20, etc.) are decoded."""
        assert validate_path("my%20folder/my%20file.md") == "my folder/my file.md"

    def test_path_traversal_raises_400(self):
        """A path containing '..' raises HTTPException 400."""
        with pytest.raises(HTTPException) as exc_info:
            validate_path("../etc/passwd")
        assert exc_info.value.status_code == 400

    def test_leading_slash_raises_400(self):
        """A path starting with '/' raises HTTPException 400."""
        with pytest.raises(HTTPException) as exc_info:
            validate_path("/absolute/path")
        assert exc_info.value.status_code == 400

    def test_double_dot_in_middle_raises_400(self):
        """'..' anywhere in the path raises HTTPException 400."""
        with pytest.raises(HTTPException) as exc_info:
            validate_path("a/../b")
        assert exc_info.value.status_code == 400

    def test_plain_filename(self):
        """A simple filename without directory separators works."""
        assert validate_path("file.md") == "file.md"

    def test_encoded_path_traversal_raises_400(self):
        """URL-encoded '..' (%2e%2e) is decoded then rejected."""
        with pytest.raises(HTTPException) as exc_info:
            validate_path("%2e%2e/etc/passwd")
        assert exc_info.value.status_code == 400

    def test_empty_string(self):
        """An empty path string is returned unchanged (no traversal)."""
        assert validate_path("") == ""


# ---------------------------------------------------------------------------
# normalize_author_field
# ---------------------------------------------------------------------------


class TestNormalizeAuthorField:
    """Tests for the normalize_author_field helper."""

    def test_string_returns_string(self):
        """A plain string value is returned as-is."""
        assert normalize_author_field("user@example.com") == "user@example.com"

    def test_none_returns_none(self):
        """None input returns None."""
        assert normalize_author_field(None) is None

    def test_dict_extracts_email(self):
        """A dict with 'email' key returns the email value."""
        assert (
            normalize_author_field({"email": "a@b.com", "name": "Alice"}) == "a@b.com"
        )

    def test_dict_extracts_name_when_no_email(self):
        """A dict without 'email' falls back to 'name'."""
        assert normalize_author_field({"name": "Bob"}) == "Bob"

    def test_dict_without_email_or_name(self):
        """A dict with neither 'email' nor 'name' returns str(dict)."""
        result = normalize_author_field({"foo": "bar"})
        # Falls through to str(value)
        assert isinstance(result, str)

    def test_empty_string_returns_none(self):
        """An empty string returns None (falsy string case)."""
        assert normalize_author_field("") is None

    def test_integer_coerced_to_string(self):
        """A non-string truthy value is coerced via str()."""
        assert normalize_author_field(42) == "42"


# ---------------------------------------------------------------------------
# BINARY_EXTENSIONS
# ---------------------------------------------------------------------------


class TestBinaryExtensions:
    """Tests for the BINARY_EXTENSIONS constant."""

    def test_contains_common_image_extensions(self):
        """Common image extensions are included."""
        for ext in (".png", ".jpg", ".jpeg", ".gif"):
            assert ext in BINARY_EXTENSIONS

    def test_contains_pdf(self):
        """PDF extension is included."""
        assert ".pdf" in BINARY_EXTENSIONS

    def test_contains_video_extensions(self):
        """Common video extensions are included."""
        for ext in (".mp4", ".mov", ".avi", ".webm"):
            assert ext in BINARY_EXTENSIONS

    def test_contains_audio_extensions(self):
        """Common audio extensions are included."""
        for ext in (".mp3", ".wav"):
            assert ext in BINARY_EXTENSIONS

    def test_contains_font_extensions(self):
        """Font file extensions are included."""
        for ext in (".woff", ".woff2", ".ttf", ".eot"):
            assert ext in BINARY_EXTENSIONS

    def test_contains_archive_extensions(self):
        """Archive extensions are included."""
        for ext in (".zip", ".tar", ".gz"):
            assert ext in BINARY_EXTENSIONS

    def test_is_a_set(self):
        """BINARY_EXTENSIONS is a set for O(1) lookups."""
        assert isinstance(BINARY_EXTENSIONS, set)

    def test_does_not_contain_markdown(self):
        """Markdown is not a binary extension."""
        assert ".md" not in BINARY_EXTENSIONS


# ---------------------------------------------------------------------------
# get_repository_path
# ---------------------------------------------------------------------------


class TestGetRepositoryPath:
    """Tests for the get_repository_path helper.

    Patches repository_service on the module namespace to isolate from
    real repository configuration.
    """

    @patch("app.routers.article_helpers.repository_service")
    def test_valid_repo_returns_path(self, mock_repo_svc, tmp_path):
        """Returns the local path when repository exists and is enabled."""
        repo_dir = tmp_path / "owner" / "repo"
        repo_dir.mkdir(parents=True)

        mock_repo_svc.get_repository.return_value = {
            "enabled": True,
            "local_path": str(repo_dir),
        }

        result = get_repository_path("owner/repo")

        assert result == repo_dir
        mock_repo_svc.get_repository.assert_called_once_with("owner/repo")

    @patch("app.routers.article_helpers.repository_service")
    def test_nonexistent_repo_raises_404(self, mock_repo_svc):
        """Raises HTTPException 404 when repository is not found."""
        mock_repo_svc.get_repository.side_effect = ValueError("not found")

        with pytest.raises(HTTPException) as exc_info:
            get_repository_path("missing/repo")
        assert exc_info.value.status_code == 404

    @patch("app.routers.article_helpers.repository_service")
    def test_disabled_repo_raises_403(self, mock_repo_svc):
        """Raises HTTPException 403 when repository is disabled."""
        mock_repo_svc.get_repository.return_value = {
            "enabled": False,
            "local_path": "/tmp/disabled-repo",
        }

        with pytest.raises(HTTPException) as exc_info:
            get_repository_path("owner/disabled-repo")
        assert exc_info.value.status_code == 403

    @patch("app.routers.article_helpers.repository_service")
    def test_missing_on_disk_raises_404(self, mock_repo_svc):
        """Raises HTTPException 404 when local_path does not exist on disk."""
        mock_repo_svc.get_repository.return_value = {
            "enabled": True,
            "local_path": "/tmp/nonexistent-path-xyz-12345",
        }

        with pytest.raises(HTTPException) as exc_info:
            get_repository_path("owner/repo")
        assert exc_info.value.status_code == 404
        assert "not found on disk" in exc_info.value.detail

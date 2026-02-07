"""Tests for the search service using Whoosh."""

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.services.search_service import SearchService


def _make_search_settings(tmp_path):
    """Create a mock SearchSettings pointing to a temp directory."""
    settings = MagicMock()
    settings.index_dir = tmp_path / "whoosh_index"
    return settings


def _make_service(tmp_path):
    """Create a SearchService with temp directories for index and repo."""
    search_settings = _make_search_settings(tmp_path)
    repo_path = tmp_path / "repo"
    repo_path.mkdir(parents=True, exist_ok=True)
    return SearchService(search_settings=search_settings, repo_path=repo_path)


# ============================================================================
# _parse_timestamp
# ============================================================================


class TestParseTimestamp:
    """Tests for the _parse_timestamp static method."""

    def test_datetime_object_returns_it(self):
        dt = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        result = SearchService._parse_timestamp(dt)
        assert result == dt

    def test_iso_string_parses_correctly(self):
        result = SearchService._parse_timestamp("2025-06-15T12:00:00+00:00")
        assert isinstance(result, datetime)
        assert result.year == 2025
        assert result.month == 6
        assert result.day == 15

    def test_none_returns_none(self):
        result = SearchService._parse_timestamp(None)
        assert result is None

    def test_invalid_string_returns_none(self):
        result = SearchService._parse_timestamp("not-a-date")
        assert result is None

    def test_empty_string_returns_none(self):
        result = SearchService._parse_timestamp("")
        assert result is None


# ============================================================================
# _normalize_author
# ============================================================================


class TestNormalizeAuthor:
    """Tests for the _normalize_author static method."""

    def test_string_returns_string(self):
        result = SearchService._normalize_author("user@example.com")
        assert result == "user@example.com"

    def test_dict_extracts_email(self):
        result = SearchService._normalize_author(
            {"name": "User", "email": "user@example.com"}
        )
        assert result == "user@example.com"

    def test_dict_extracts_name_when_no_email(self):
        result = SearchService._normalize_author({"name": "User"})
        assert result == "User"

    def test_none_returns_default(self):
        result = SearchService._normalize_author(None)
        assert result == "unknown"

    def test_none_returns_custom_default(self):
        result = SearchService._normalize_author(None, default="system")
        assert result == "system"

    def test_empty_string_returns_default(self):
        # Empty string is falsy, so it returns the default
        result = SearchService._normalize_author("")
        assert result == "unknown"

    def test_dict_with_only_string_repr(self):
        result = SearchService._normalize_author({"id": 123})
        # No email or name, falls through to str(value)
        assert "123" in result


# ============================================================================
# index_article and search round-trip
# ============================================================================


class TestIndexAndSearch:
    """Tests for indexing articles and searching them."""

    def test_index_and_search_round_trip(self, tmp_path):
        service = _make_service(tmp_path)

        now = datetime.now(timezone.utc)
        service.index_article(
            path="guides/install.md",
            title="Installation Guide",
            content="How to install WikiGit on your server step by step.",
            author="admin@example.com",
            created_at=now,
            updated_at=now,
            updated_by="admin@example.com",
        )

        results = service.search("install")
        assert len(results) >= 1
        assert results[0].path == "guides/install.md"
        assert results[0].title == "Installation Guide"

    def test_search_by_content(self, tmp_path):
        service = _make_service(tmp_path)

        now = datetime.now(timezone.utc)
        service.index_article(
            path="docs/config.md",
            title="Configuration",
            content="Set the database connection string in config.yaml for PostgreSQL.",
            author="admin@example.com",
            created_at=now,
            updated_at=now,
            updated_by="admin@example.com",
        )

        results = service.search("PostgreSQL")
        assert len(results) >= 1
        assert results[0].path == "docs/config.md"

    def test_index_with_repository_id(self, tmp_path):
        service = _make_service(tmp_path)

        now = datetime.now(timezone.utc)
        service.index_article(
            path="myorg/wiki:README.md",
            title="Wiki Home",
            content="Welcome to the wiki.",
            author="admin@example.com",
            created_at=now,
            updated_at=now,
            updated_by="admin@example.com",
            repository_id="myorg/wiki",
            repository_name="wiki",
        )

        results = service.search("wiki")
        assert len(results) >= 1
        # Path should strip the repository prefix
        assert results[0].path == "README.md"
        assert results[0].repository_id == "myorg/wiki"

    def test_update_existing_document(self, tmp_path):
        service = _make_service(tmp_path)

        now = datetime.now(timezone.utc)
        service.index_article(
            path="test.md",
            title="Original Title",
            content="Original content.",
            author="admin@example.com",
            created_at=now,
            updated_at=now,
            updated_by="admin@example.com",
        )

        # Update the same path
        service.index_article(
            path="test.md",
            title="Updated Title",
            content="Updated content with new information.",
            author="admin@example.com",
            created_at=now,
            updated_at=now,
            updated_by="editor@example.com",
        )

        results = service.search("Updated")
        assert len(results) == 1
        assert results[0].title == "Updated Title"


# ============================================================================
# remove_article
# ============================================================================


class TestRemoveArticle:
    """Tests for removing articles from the search index."""

    def test_removes_from_index(self, tmp_path):
        service = _make_service(tmp_path)

        now = datetime.now(timezone.utc)
        service.index_article(
            path="to-remove.md",
            title="Temporary Article",
            content="This article will be removed.",
            author="admin@example.com",
            created_at=now,
            updated_at=now,
            updated_by="admin@example.com",
        )

        # Verify it's indexed
        results = service.search("Temporary")
        assert len(results) >= 1

        # Remove it
        service.remove_article("to-remove.md")

        # Verify it's gone
        results = service.search("Temporary")
        assert len(results) == 0


# ============================================================================
# search edge cases
# ============================================================================


class TestSearchEdgeCases:
    """Tests for search edge cases."""

    def test_empty_query_returns_empty(self, tmp_path):
        service = _make_service(tmp_path)
        results = service.search("")
        assert results == []

    def test_whitespace_query_returns_empty(self, tmp_path):
        service = _make_service(tmp_path)
        results = service.search("   ")
        assert results == []

    def test_no_matches_returns_empty(self, tmp_path):
        service = _make_service(tmp_path)

        now = datetime.now(timezone.utc)
        service.index_article(
            path="test.md",
            title="Test Article",
            content="Some content here.",
            author="admin@example.com",
            created_at=now,
            updated_at=now,
            updated_by="admin@example.com",
        )

        results = service.search("xyzzzznonexistent")
        assert results == []

    def test_search_with_repository_id_filter(self, tmp_path):
        service = _make_service(tmp_path)

        now = datetime.now(timezone.utc)
        # Add article in repo A
        service.index_article(
            path="repoA:doc.md",
            title="Repo A Doc",
            content="Documentation for repository A.",
            author="admin@example.com",
            created_at=now,
            updated_at=now,
            updated_by="admin@example.com",
            repository_id="repoA",
            repository_name="Repo A",
        )

        # Add article in repo B
        service.index_article(
            path="repoB:doc.md",
            title="Repo B Doc",
            content="Documentation for repository B.",
            author="admin@example.com",
            created_at=now,
            updated_at=now,
            updated_by="admin@example.com",
            repository_id="repoB",
            repository_name="Repo B",
        )

        # Search across all repos
        all_results = service.search("Documentation")
        assert len(all_results) == 2

        # Search filtered to repo A only
        filtered = service.search("Documentation", repository_id="repoA")
        assert len(filtered) == 1
        assert filtered[0].repository_id == "repoA"

    def test_score_normalization(self, tmp_path):
        service = _make_service(tmp_path)

        now = datetime.now(timezone.utc)
        service.index_article(
            path="high.md",
            title="Python Tutorial",
            content="Python Python Python extensive Python guide.",
            author="admin@example.com",
            created_at=now,
            updated_at=now,
            updated_by="admin@example.com",
        )
        service.index_article(
            path="low.md",
            title="Other Guide",
            content="A brief mention of Python in this guide.",
            author="admin@example.com",
            created_at=now,
            updated_at=now,
            updated_by="admin@example.com",
        )

        results = service.search("Python")
        assert len(results) >= 1
        # The highest scoring result should have score normalized to ~1.0
        assert results[0].score == pytest.approx(1.0, abs=0.01)
        # All scores should be between 0 and 1
        for r in results:
            assert 0.0 <= r.score <= 1.0

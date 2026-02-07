"""Tests for FrontmatterService.

Target: app/services/frontmatter_service.py
Tier 2: Service with some mocking needed (git metadata).
"""

import re
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.services.frontmatter_service import FrontmatterService


@pytest.fixture
def service():
    """Create a FrontmatterService instance."""
    return FrontmatterService()


# ---------------------------------------------------------------------------
# parse_article
# ---------------------------------------------------------------------------


class TestParseArticle:
    """Tests for FrontmatterService.parse_article."""

    def test_parse_with_frontmatter(self, service, tmp_path):
        """Parsing a file with frontmatter returns metadata dict and content."""
        md = tmp_path / "article.md"
        md.write_text(
            "---\ntitle: Test Article\nauthor: user@example.com\n---\n# Content\n\nBody text."
        )

        metadata, content = service.parse_article(md)

        assert metadata["title"] == "Test Article"
        assert metadata["author"] == "user@example.com"
        assert "# Content" in content
        assert "Body text." in content
        # Frontmatter delimiters should not appear in content
        assert "---" not in content

    def test_parse_without_frontmatter(self, service, tmp_path):
        """Parsing a file without frontmatter returns empty metadata and full content."""
        md = tmp_path / "plain.md"
        md.write_text("# Just Content\n\nNo frontmatter here.")

        metadata, content = service.parse_article(md)

        assert metadata == {}
        assert "# Just Content" in content
        assert "No frontmatter here." in content

    def test_parse_nonexistent_file(self, service, tmp_path):
        """Parsing a non-existent file raises FileNotFoundError."""
        missing = tmp_path / "does_not_exist.md"

        with pytest.raises(FileNotFoundError):
            service.parse_article(missing)

    def test_parse_empty_file(self, service, tmp_path):
        """Parsing an empty file returns empty metadata and empty content."""
        md = tmp_path / "empty.md"
        md.write_text("")

        metadata, content = service.parse_article(md)

        assert metadata == {}
        assert content == ""

    def test_parse_preserves_all_metadata_keys(self, service, tmp_path):
        """All frontmatter keys are returned in the metadata dict."""
        md = tmp_path / "full.md"
        md.write_text(
            "---\n"
            "title: Full Article\n"
            "author: a@b.com\n"
            "created_at: 2025-01-01T00:00:00Z\n"
            "updated_at: 2025-06-15T12:00:00Z\n"
            "updated_by: c@d.com\n"
            "---\n"
            "Body"
        )

        metadata, _ = service.parse_article(md)

        assert set(metadata.keys()) == {
            "title",
            "author",
            "created_at",
            "updated_at",
            "updated_by",
        }


# ---------------------------------------------------------------------------
# create_frontmatter
# ---------------------------------------------------------------------------


class TestCreateFrontmatter:
    """Tests for FrontmatterService.create_frontmatter."""

    def test_creates_valid_frontmatter(self, service):
        """create_frontmatter produces a string with YAML frontmatter and content."""
        result = service.create_frontmatter(
            title="New Article",
            author_email="author@example.com",
            content="# New Article\n\nHello world.",
        )

        assert result.startswith("---\n")
        assert "title: New Article" in result
        assert "author: author@example.com" in result
        assert "# New Article" in result
        assert "Hello world." in result

    def test_timestamps_present(self, service):
        """Both created_at and updated_at are set in the frontmatter."""
        result = service.create_frontmatter("T", "a@b.com", "content")

        assert "created_at:" in result
        assert "updated_at:" in result

    def test_updated_by_matches_author(self, service):
        """For new articles, updated_by equals the author email."""
        result = service.create_frontmatter("T", "writer@test.com", "c")

        assert "updated_by: writer@test.com" in result

    def test_round_trip_with_parse(self, service, tmp_path):
        """Created frontmatter can be parsed back to identical metadata fields."""
        markdown = service.create_frontmatter("Round Trip", "r@t.com", "Body")
        md_file = tmp_path / "rt.md"
        md_file.write_text(markdown)

        metadata, content = service.parse_article(md_file)

        assert metadata["title"] == "Round Trip"
        assert metadata["author"] == "r@t.com"
        assert content.strip() == "Body"


# ---------------------------------------------------------------------------
# update_frontmatter
# ---------------------------------------------------------------------------


class TestUpdateFrontmatter:
    """Tests for FrontmatterService.update_frontmatter."""

    def test_preserves_original_title_and_author(self, service, tmp_path):
        """update_frontmatter preserves original title, author, and created_at."""
        md = tmp_path / "existing.md"
        original = service.create_frontmatter(
            "Original Title", "original@author.com", "Old content"
        )
        md.write_text(original)

        result = service.update_frontmatter(md, "editor@example.com", "New content")

        # Write and re-parse to check metadata
        md.write_text(result)
        metadata, content = service.parse_article(md)

        assert metadata["title"] == "Original Title"
        assert metadata["author"] == "original@author.com"
        assert metadata["updated_by"] == "editor@example.com"
        assert content.strip() == "New content"

    def test_updates_updated_at_and_updated_by(self, service, tmp_path):
        """update_frontmatter changes updated_at and updated_by."""
        md = tmp_path / "update.md"
        md.write_text(
            "---\n"
            "title: Article\n"
            "author: orig@test.com\n"
            "created_at: '2025-01-01T00:00:00Z'\n"
            "updated_at: '2025-01-01T00:00:00Z'\n"
            "updated_by: orig@test.com\n"
            "---\n"
            "Old body"
        )

        result = service.update_frontmatter(md, "new@editor.com", "New body")
        md.write_text(result)
        metadata, _ = service.parse_article(md)

        assert metadata["updated_by"] == "new@editor.com"
        # updated_at should differ from the original static value
        assert metadata["updated_at"] != "2025-01-01T00:00:00Z"

    def test_creates_frontmatter_when_none_exists(self, service, tmp_path):
        """update_frontmatter creates frontmatter if the file has none."""
        md = tmp_path / "no_fm.md"
        md.write_text("# Title From Content\n\nPlain markdown.")

        # Note: update_frontmatter extracts title from the NEW content param,
        # not the file's original content.  When the new content has a heading,
        # it is used as the title.
        result = service.update_frontmatter(
            md, "migrator@test.com", "# Title From Content\n\nUpdated body"
        )
        md.write_text(result)
        metadata, content = service.parse_article(md)

        assert metadata["title"] == "Title From Content"
        assert metadata["author"] == "migrator@test.com"
        assert "Updated body" in content

    def test_creates_frontmatter_falls_back_to_filename(self, service, tmp_path):
        """When new content has no heading, title falls back to the filename stem."""
        md = tmp_path / "my-article.md"
        md.write_text("Just plain text, no heading.")

        result = service.update_frontmatter(md, "migrator@test.com", "Updated body")
        md.write_text(result)
        metadata, _ = service.parse_article(md)

        assert metadata["title"] == "my-article"
        assert metadata["author"] == "migrator@test.com"

    def test_handles_dict_author_legacy_migration(self, service, tmp_path):
        """update_frontmatter normalises a dict-format author to a string."""
        md = tmp_path / "legacy.md"
        md.write_text(
            "---\n"
            "title: Legacy Article\n"
            "author:\n"
            "  email: legacy@user.com\n"
            "  name: Legacy User\n"
            "created_at: '2024-06-01T00:00:00Z'\n"
            "updated_at: '2024-06-01T00:00:00Z'\n"
            "updated_by: legacy@user.com\n"
            "---\n"
            "Content"
        )

        result = service.update_frontmatter(md, "editor@test.com", "New content")
        md.write_text(result)
        metadata, _ = service.parse_article(md)

        # Dict author should be normalised to the email string
        assert metadata["author"] == "legacy@user.com"

    def test_sets_created_at_if_missing(self, service, tmp_path):
        """update_frontmatter fills in created_at when it is absent."""
        md = tmp_path / "no_created.md"
        md.write_text("---\ntitle: No Created\nauthor: a@b.com\n---\nBody")

        result = service.update_frontmatter(md, "e@f.com", "Body")
        md.write_text(result)
        metadata, _ = service.parse_article(md)

        assert "created_at" in metadata

    def test_sets_author_if_missing(self, service, tmp_path):
        """update_frontmatter fills in author when it is absent."""
        md = tmp_path / "no_author.md"
        md.write_text(
            "---\ntitle: No Author\ncreated_at: '2025-01-01T00:00:00Z'\n---\nBody"
        )

        result = service.update_frontmatter(md, "fallback@test.com", "Body")
        md.write_text(result)
        metadata, _ = service.parse_article(md)

        assert metadata["author"] == "fallback@test.com"


# ---------------------------------------------------------------------------
# serialize_article
# ---------------------------------------------------------------------------


class TestSerializeArticle:
    """Tests for FrontmatterService.serialize_article."""

    def test_round_trip(self, service, tmp_path):
        """Serialising then parsing returns identical metadata and content."""
        metadata = {
            "title": "Roundtrip",
            "author": "rt@test.com",
            "created_at": "2025-01-01T00:00:00Z",
        }
        content = "# Roundtrip\n\nParagraph."

        serialized = service.serialize_article(metadata, content)
        md_file = tmp_path / "roundtrip.md"
        md_file.write_text(serialized)
        parsed_meta, parsed_content = service.parse_article(md_file)

        assert parsed_meta["title"] == "Roundtrip"
        assert parsed_meta["author"] == "rt@test.com"
        assert parsed_content.strip() == content.strip()

    def test_output_contains_frontmatter_delimiters(self, service):
        """Serialized output starts with --- frontmatter delimiters."""
        result = service.serialize_article({"title": "X"}, "body")
        assert result.startswith("---\n")

    def test_empty_metadata(self, service):
        """Serializing with empty metadata still produces valid output."""
        result = service.serialize_article({}, "Just content")
        assert "Just content" in result


# ---------------------------------------------------------------------------
# extract_title_from_content
# ---------------------------------------------------------------------------


class TestExtractTitleFromContent:
    """Tests for FrontmatterService.extract_title_from_content."""

    def test_atx_heading(self):
        """Extracts title from ATX-style heading '# Title'."""
        assert (
            FrontmatterService.extract_title_from_content("# My Title\n\nBody")
            == "My Title"
        )

    def test_setext_heading(self):
        """Extracts title from setext-style heading with = underline."""
        assert (
            FrontmatterService.extract_title_from_content("My Title\n===\n\nBody")
            == "My Title"
        )

    def test_returns_none_for_empty(self):
        """Returns None for empty content."""
        assert FrontmatterService.extract_title_from_content("") is None

    def test_returns_none_for_no_heading(self):
        """Returns None when there is no H1 heading."""
        assert (
            FrontmatterService.extract_title_from_content("Just a paragraph.") is None
        )

    def test_returns_none_for_none_input(self):
        """Returns None when content is None."""
        assert FrontmatterService.extract_title_from_content(None) is None

    def test_takes_first_h1(self):
        """If multiple H1 headings exist, the first one is returned."""
        content = "# First Title\n\n# Second Title"
        assert FrontmatterService.extract_title_from_content(content) == "First Title"

    def test_strips_whitespace(self):
        """Leading/trailing whitespace in heading text is stripped."""
        assert (
            FrontmatterService.extract_title_from_content("#   Spaced  \n") == "Spaced"
        )


# ---------------------------------------------------------------------------
# get_current_timestamp
# ---------------------------------------------------------------------------


class TestGetCurrentTimestamp:
    """Tests for FrontmatterService.get_current_timestamp."""

    def test_returns_iso8601_z_format(self):
        """Timestamp matches ISO 8601 UTC format YYYY-MM-DDTHH:MM:SSZ."""
        ts = FrontmatterService.get_current_timestamp()
        pattern = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$"
        assert re.match(pattern, ts), (
            f"Timestamp '{ts}' does not match ISO 8601 Z-format"
        )

    def test_ends_with_z(self):
        """Timestamp ends with 'Z' to indicate UTC."""
        ts = FrontmatterService.get_current_timestamp()
        assert ts.endswith("Z")


# ---------------------------------------------------------------------------
# _get_git_metadata
# ---------------------------------------------------------------------------


class TestGetGitMetadata:
    """Tests for FrontmatterService._get_git_metadata (private helper)."""

    def test_returns_none_for_non_git_directory(self, service, tmp_path):
        """Returns None when the file is not in a git repository."""
        plain_file = tmp_path / "plain.md"
        plain_file.write_text("hello")

        result = service._get_git_metadata(plain_file)
        assert result is None

    def test_returns_dict_with_expected_keys_on_success(self, service):
        """When git metadata is available, result contains author and created_at."""
        mock_commit = MagicMock()
        mock_commit.author.email = "committer@test.com"
        mock_commit.committed_date = 1700000000  # 2023-11-14T22:13:20Z

        with patch("app.services.frontmatter_service.git.Repo") as MockRepo:
            MockRepo.return_value.iter_commits.return_value = iter([mock_commit])
            result = service._get_git_metadata(Path("/fake/file.md"))

        assert result is not None
        assert result["author"] == "committer@test.com"
        assert "created_at" in result

    def test_returns_none_when_no_commits(self, service):
        """Returns None when there are no commits for the file."""
        with patch("app.services.frontmatter_service.git.Repo") as MockRepo:
            MockRepo.return_value.iter_commits.return_value = iter([])
            result = service._get_git_metadata(Path("/fake/file.md"))

        assert result is None


# ---------------------------------------------------------------------------
# add_frontmatter_if_missing
# ---------------------------------------------------------------------------


class TestAddFrontmatterIfMissing:
    """Tests for FrontmatterService.add_frontmatter_if_missing."""

    def test_adds_frontmatter_to_plain_file(self, service, tmp_path):
        """Adds frontmatter to a file that has none."""
        md = tmp_path / "plain.md"
        md.write_text("# My Doc\n\nSome content.")

        with patch.object(service, "_get_git_metadata", return_value=None):
            service.add_frontmatter_if_missing(md, "default@author.com")

        metadata, content = service.parse_article(md)
        assert metadata["title"] == "My Doc"
        assert metadata["author"] == "default@author.com"
        assert "Some content." in content

    def test_skips_file_with_existing_frontmatter(self, service, tmp_path):
        """Does not modify a file that already has frontmatter."""
        md = tmp_path / "has_fm.md"
        original_text = "---\ntitle: Existing\nauthor: a@b.com\n---\nBody"
        md.write_text(original_text)

        service.add_frontmatter_if_missing(md, "default@author.com")

        # File should be unchanged
        assert md.read_text() == original_text

    def test_uses_git_metadata_when_available(self, service, tmp_path):
        """Uses author and created_at from git history if available."""
        md = tmp_path / "git_meta.md"
        md.write_text("# Git Article\n\nBody.")

        git_meta = {"author": "git@author.com", "created_at": "2024-01-01T00:00:00Z"}
        with patch.object(service, "_get_git_metadata", return_value=git_meta):
            service.add_frontmatter_if_missing(md, "fallback@author.com")

        metadata, _ = service.parse_article(md)
        assert metadata["author"] == "git@author.com"

    def test_uses_filename_as_title_when_no_heading(self, service, tmp_path):
        """Falls back to filename-derived title when content has no H1."""
        md = tmp_path / "my-cool-doc.md"
        md.write_text("Just a paragraph, no heading.")

        with patch.object(service, "_get_git_metadata", return_value=None):
            service.add_frontmatter_if_missing(md, "default@author.com")

        metadata, _ = service.parse_article(md)
        assert metadata["title"] == "My Cool Doc"

    def test_raises_for_nonexistent_file(self, service, tmp_path):
        """Raises FileNotFoundError for a missing file."""
        missing = tmp_path / "nope.md"
        with pytest.raises(FileNotFoundError):
            service.add_frontmatter_if_missing(missing, "a@b.com")

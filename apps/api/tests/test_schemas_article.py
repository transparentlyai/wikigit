"""Tests for article, directory, and search Pydantic models."""

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.models.schemas.article import (
    Article,
    ArticleCreate,
    ArticleListResponse,
    ArticleMove,
    ArticleSummary,
    ArticleUpdate,
    Directory,
    DirectoryCreate,
    DirectoryMove,
    DirectoryNode,
    DirectoryTreeResponse,
    IndexStats,
    SearchResponse,
    SearchResult,
)


# ============================================================================
# Article
# ============================================================================


class TestArticle:
    """Tests for the Article model."""

    def test_construction_with_required_fields(self):
        article = Article(path="README.md", title="README", content="# Hello")
        assert article.path == "README.md"
        assert article.title == "README"
        assert article.content == "# Hello"

    def test_optional_fields_default_to_none(self):
        article = Article(path="test.md", title="Test", content="body")
        assert article.author is None
        assert article.created_at is None
        assert article.updated_at is None
        assert article.updated_by is None
        assert article.warning is None

    def test_construction_with_all_fields(self):
        now = datetime.now(timezone.utc)
        article = Article(
            path="guides/install.md",
            title="Install Guide",
            content="# Install",
            author="admin@example.com",
            created_at=now,
            updated_at=now,
            updated_by="editor@example.com",
            warning="Draft",
        )
        assert article.author == "admin@example.com"
        assert article.created_at == now
        assert article.updated_at == now
        assert article.updated_by == "editor@example.com"
        assert article.warning == "Draft"

    def test_missing_required_field_raises(self):
        with pytest.raises(ValidationError):
            Article(path="test.md", title="Test")  # missing content

    def test_serialization_round_trip(self):
        article = Article(path="test.md", title="Test", content="body")
        data = article.model_dump()
        restored = Article(**data)
        assert restored == article

    def test_json_serialization(self):
        article = Article(path="test.md", title="Test", content="body")
        json_str = article.model_dump_json()
        restored = Article.model_validate_json(json_str)
        assert restored == article


# ============================================================================
# ArticleCreate
# ============================================================================


class TestArticleCreate:
    """Tests for ArticleCreate validation."""

    def test_valid_creation(self):
        ac = ArticleCreate(path="new-article.md", content="# New Article")
        assert ac.path == "new-article.md"
        assert ac.content == "# New Article"
        assert ac.title is None

    def test_valid_creation_with_title(self):
        ac = ArticleCreate(
            path="guides/tutorial.md", content="# Tutorial", title="Tutorial"
        )
        assert ac.title == "Tutorial"

    def test_nested_path(self):
        ac = ArticleCreate(path="guides/deep/nested/article.md", content="content")
        assert ac.path == "guides/deep/nested/article.md"

    def test_validate_path_extension_must_end_in_md(self):
        with pytest.raises(ValidationError, match="must end with .md"):
            ArticleCreate(path="article.txt", content="content")

    def test_validate_path_extension_no_extension(self):
        with pytest.raises(ValidationError, match="must end with .md"):
            ArticleCreate(path="article", content="content")

    def test_validate_path_extension_wrong_extension(self):
        with pytest.raises(ValidationError, match="must end with .md"):
            ArticleCreate(path="article.html", content="content")

    def test_validate_path_no_traversal_double_dots(self):
        with pytest.raises(ValidationError, match="path traversal not allowed"):
            ArticleCreate(path="../evil.md", content="content")

    def test_validate_path_no_traversal_embedded_double_dots(self):
        with pytest.raises(ValidationError, match="path traversal not allowed"):
            ArticleCreate(path="guides/../../etc/passwd.md", content="content")

    def test_validate_path_no_traversal_leading_slash(self):
        with pytest.raises(ValidationError, match="path traversal not allowed"):
            ArticleCreate(path="/absolute/path.md", content="content")

    def test_validate_path_empty_string_rejected(self):
        with pytest.raises(ValidationError):
            ArticleCreate(path="", content="content")

    def test_validate_content_empty_string_rejected(self):
        with pytest.raises(ValidationError):
            ArticleCreate(path="test.md", content="")

    def test_serialization(self):
        ac = ArticleCreate(path="test.md", content="body", title="Test")
        data = ac.model_dump()
        assert data["path"] == "test.md"
        assert data["content"] == "body"
        assert data["title"] == "Test"


# ============================================================================
# ArticleUpdate
# ============================================================================


class TestArticleUpdate:
    """Tests for ArticleUpdate model."""

    def test_valid_update(self):
        au = ArticleUpdate(content="# Updated content")
        assert au.content == "# Updated content"

    def test_empty_content_rejected(self):
        with pytest.raises(ValidationError):
            ArticleUpdate(content="")

    def test_missing_content_rejected(self):
        with pytest.raises(ValidationError):
            ArticleUpdate()


# ============================================================================
# ArticleMove
# ============================================================================


class TestArticleMove:
    """Tests for ArticleMove model."""

    def test_valid_move(self):
        am = ArticleMove(new_path="new-location.md")
        assert am.new_path == "new-location.md"

    def test_valid_move_nested(self):
        am = ArticleMove(new_path="guides/advanced/topic.md")
        assert am.new_path == "guides/advanced/topic.md"

    def test_path_without_md_extension_allowed(self):
        """ArticleMove allows paths without .md extension per the schema."""
        am = ArticleMove(new_path="new-location")
        assert am.new_path == "new-location"

    def test_validate_path_no_traversal_double_dots(self):
        with pytest.raises(ValidationError, match="contains '..' or starts with '/'"):
            ArticleMove(new_path="../escape.md")

    def test_validate_path_no_traversal_embedded_double_dots(self):
        with pytest.raises(ValidationError, match="contains '..' or starts with '/'"):
            ArticleMove(new_path="a/../../b.md")

    def test_validate_path_no_traversal_leading_slash(self):
        with pytest.raises(ValidationError, match="contains '..' or starts with '/'"):
            ArticleMove(new_path="/absolute/path.md")

    def test_empty_path_rejected(self):
        with pytest.raises(ValidationError):
            ArticleMove(new_path="")


# ============================================================================
# ArticleSummary
# ============================================================================


class TestArticleSummary:
    """Tests for ArticleSummary model."""

    def test_construction_with_required_fields(self):
        s = ArticleSummary(path="README.md", title="README")
        assert s.path == "README.md"
        assert s.title == "README"

    def test_optional_fields_default_to_none(self):
        s = ArticleSummary(path="test.md", title="Test")
        assert s.author is None
        assert s.updated_at is None
        assert s.updated_by is None

    def test_construction_with_all_fields(self):
        now = datetime.now(timezone.utc)
        s = ArticleSummary(
            path="test.md",
            title="Test",
            author="admin@example.com",
            updated_at=now,
            updated_by="editor@example.com",
        )
        assert s.author == "admin@example.com"
        assert s.updated_at == now
        assert s.updated_by == "editor@example.com"


# ============================================================================
# ArticleListResponse
# ============================================================================


class TestArticleListResponse:
    """Tests for ArticleListResponse model."""

    def test_default_empty_list(self):
        resp = ArticleListResponse()
        assert resp.articles == []

    def test_with_articles(self):
        articles = [
            ArticleSummary(path="a.md", title="A"),
            ArticleSummary(path="b.md", title="B"),
        ]
        resp = ArticleListResponse(articles=articles)
        assert len(resp.articles) == 2
        assert resp.articles[0].path == "a.md"


# ============================================================================
# DirectoryNode
# ============================================================================


class TestDirectoryNode:
    """Tests for DirectoryNode model and its validator."""

    def test_file_node_without_children(self):
        node = DirectoryNode(type="file", name="readme.md", path="readme.md")
        assert node.type == "file"
        assert node.children is None

    def test_file_node_with_children_raises(self):
        with pytest.raises(ValidationError, match="Files cannot have children"):
            DirectoryNode(
                type="file",
                name="readme.md",
                path="readme.md",
                children=[],
            )

    def test_directory_node_gets_empty_children_by_default(self):
        node = DirectoryNode(type="directory", name="guides", path="guides")
        assert node.children == []

    def test_directory_node_with_explicit_children(self):
        child = DirectoryNode(type="file", name="a.md", path="guides/a.md")
        node = DirectoryNode(
            type="directory", name="guides", path="guides", children=[child]
        )
        assert len(node.children) == 1
        assert node.children[0].name == "a.md"

    def test_nested_directory_structure(self):
        file_node = DirectoryNode(type="file", name="deep.md", path="a/b/deep.md")
        inner_dir = DirectoryNode(
            type="directory", name="b", path="a/b", children=[file_node]
        )
        outer_dir = DirectoryNode(
            type="directory", name="a", path="a", children=[inner_dir]
        )
        assert outer_dir.children[0].children[0].name == "deep.md"

    def test_invalid_type_rejected(self):
        with pytest.raises(ValidationError):
            DirectoryNode(type="symlink", name="link", path="link")

    def test_serialization_round_trip(self):
        node = DirectoryNode(type="directory", name="docs", path="docs")
        data = node.model_dump()
        restored = DirectoryNode(**data)
        assert restored.type == "directory"
        assert restored.children == []


# ============================================================================
# Directory
# ============================================================================


class TestDirectory:
    """Tests for Directory model."""

    def test_construction(self):
        d = Directory(path="guides", name="guides")
        assert d.path == "guides"
        assert d.name == "guides"
        assert d.children == []

    def test_with_children(self):
        child = DirectoryNode(type="file", name="a.md", path="guides/a.md")
        d = Directory(path="guides", name="guides", children=[child])
        assert len(d.children) == 1


# ============================================================================
# DirectoryCreate
# ============================================================================


class TestDirectoryCreate:
    """Tests for DirectoryCreate model."""

    def test_valid_path(self):
        dc = DirectoryCreate(path="guides/advanced")
        assert dc.path == "guides/advanced"

    def test_validate_path_no_traversal_double_dots(self):
        with pytest.raises(ValidationError, match="path traversal not allowed"):
            DirectoryCreate(path="../escape")

    def test_validate_path_no_traversal_leading_slash(self):
        with pytest.raises(ValidationError, match="path traversal not allowed"):
            DirectoryCreate(path="/absolute/path")

    def test_empty_path_rejected(self):
        with pytest.raises(ValidationError):
            DirectoryCreate(path="")


# ============================================================================
# DirectoryMove
# ============================================================================


class TestDirectoryMove:
    """Tests for DirectoryMove model."""

    def test_valid_move(self):
        dm = DirectoryMove(new_path="new-dir")
        assert dm.new_path == "new-dir"

    def test_validate_path_no_traversal_double_dots(self):
        with pytest.raises(ValidationError, match="contains '..' or starts with '/'"):
            DirectoryMove(new_path="../escape")

    def test_validate_path_no_traversal_leading_slash(self):
        with pytest.raises(ValidationError, match="contains '..' or starts with '/'"):
            DirectoryMove(new_path="/absolute")

    def test_empty_path_rejected(self):
        with pytest.raises(ValidationError):
            DirectoryMove(new_path="")


# ============================================================================
# DirectoryTreeResponse
# ============================================================================


class TestDirectoryTreeResponse:
    """Tests for DirectoryTreeResponse model."""

    def test_default_empty_tree(self):
        resp = DirectoryTreeResponse()
        assert resp.tree == []

    def test_with_tree_nodes(self):
        node = DirectoryNode(type="directory", name="root", path="root")
        resp = DirectoryTreeResponse(tree=[node])
        assert len(resp.tree) == 1


# ============================================================================
# SearchResult
# ============================================================================


class TestSearchResult:
    """Tests for SearchResult model."""

    def test_valid_construction(self):
        sr = SearchResult(
            path="guide.md",
            title="Guide",
            snippet="matched text",
            score=0.85,
        )
        assert sr.path == "guide.md"
        assert sr.score == 0.85
        assert sr.repository_id is None
        assert sr.repository_name is None

    def test_with_repository_fields(self):
        sr = SearchResult(
            path="guide.md",
            title="Guide",
            snippet="matched text",
            score=0.5,
            repository_id="wiki-main",
            repository_name="Main Wiki",
        )
        assert sr.repository_id == "wiki-main"
        assert sr.repository_name == "Main Wiki"

    def test_score_minimum_boundary(self):
        sr = SearchResult(path="a.md", title="A", snippet="s", score=0.0)
        assert sr.score == 0.0

    def test_score_maximum_boundary(self):
        sr = SearchResult(path="a.md", title="A", snippet="s", score=1.0)
        assert sr.score == 1.0

    def test_score_below_zero_rejected(self):
        with pytest.raises(ValidationError):
            SearchResult(path="a.md", title="A", snippet="s", score=-0.1)

    def test_score_above_one_rejected(self):
        with pytest.raises(ValidationError):
            SearchResult(path="a.md", title="A", snippet="s", score=1.1)

    def test_serialization(self):
        sr = SearchResult(path="a.md", title="A", snippet="s", score=0.5)
        data = sr.model_dump()
        assert data["score"] == 0.5
        restored = SearchResult(**data)
        assert restored == sr


# ============================================================================
# SearchResponse
# ============================================================================


class TestSearchResponse:
    """Tests for SearchResponse model."""

    def test_valid_construction(self):
        resp = SearchResponse(query="test", results=[], total=0)
        assert resp.query == "test"
        assert resp.results == []
        assert resp.total == 0

    def test_with_results(self):
        result = SearchResult(path="a.md", title="A", snippet="s", score=0.9)
        resp = SearchResponse(query="search", results=[result], total=1)
        assert len(resp.results) == 1

    def test_negative_total_rejected(self):
        with pytest.raises(ValidationError):
            SearchResponse(query="test", results=[], total=-1)

    def test_missing_query_rejected(self):
        with pytest.raises(ValidationError):
            SearchResponse(results=[], total=0)


# ============================================================================
# IndexStats
# ============================================================================


class TestIndexStats:
    """Tests for IndexStats model."""

    def test_valid_construction(self):
        stats = IndexStats(
            status="completed", document_count=42, message="Indexed 42 articles"
        )
        assert stats.status == "completed"
        assert stats.document_count == 42
        assert stats.message == "Indexed 42 articles"

    def test_zero_document_count(self):
        stats = IndexStats(status="empty", document_count=0, message="No documents")
        assert stats.document_count == 0

    def test_negative_document_count_rejected(self):
        with pytest.raises(ValidationError):
            IndexStats(status="error", document_count=-1, message="bad")

    def test_missing_required_fields(self):
        with pytest.raises(ValidationError):
            IndexStats(status="ok")

    def test_serialization_round_trip(self):
        stats = IndexStats(status="ok", document_count=10, message="Done")
        data = stats.model_dump()
        restored = IndexStats(**data)
        assert restored == stats

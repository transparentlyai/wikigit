"""Integration tests for the articles router.

Tests endpoints under /repositories/{repository_id}/articles.
"""

from unittest.mock import patch, MagicMock

from tests.integration.conftest import AUTH_HEADER

REPO_ID = "owner-test-repo"
BASE = f"/repositories/{REPO_ID}"


class TestListArticles:
    """Tests for GET /repositories/{id}/articles."""

    async def test_returns_empty_list_for_empty_repo(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
            }
            resp = await client.get(f"{BASE}/articles", headers=AUTH_HEADER)
        assert resp.status_code == 200
        data = resp.json()
        assert data["articles"] == []

    async def test_returns_articles_with_frontmatter(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        md_file = repo_path / "hello.md"
        md_file.write_text("---\ntitle: Hello\n---\nContent here")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
            patch("app.routers.articles.frontmatter_service") as mock_fm,
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
            }
            mock_fm.parse_article.return_value = (
                {
                    "title": "Hello",
                    "author": "admin@example.com",
                    "updated_at": None,
                    "updated_by": None,
                },
                "Content here",
            )
            resp = await client.get(f"{BASE}/articles", headers=AUTH_HEADER)

        assert resp.status_code == 200
        articles = resp.json()["articles"]
        assert len(articles) == 1
        assert articles[0]["title"] == "Hello"
        assert articles[0]["path"] == "hello.md"

    async def test_unauthenticated_returns_401(self, client):
        resp = await client.get(f"{BASE}/articles")
        assert resp.status_code == 401


class TestGetArticle:
    """Tests for GET /repositories/{id}/articles/{path}."""

    async def test_returns_article_content(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        md_file = repo_path / "test.md"
        md_file.write_text("---\ntitle: Test\n---\nBody")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
            patch("app.routers.articles.frontmatter_service") as mock_fm,
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
            }
            mock_fm.parse_article.return_value = (
                {
                    "title": "Test",
                    "author": None,
                    "created_at": None,
                    "updated_at": None,
                    "updated_by": None,
                },
                "Body",
            )
            resp = await client.get(f"{BASE}/articles/test.md", headers=AUTH_HEADER)

        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Test"
        assert data["content"] == "Body"
        assert data["path"] == "test.md"

    async def test_not_found_returns_404(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
            }
            resp = await client.get(f"{BASE}/articles/missing.md", headers=AUTH_HEADER)
        assert resp.status_code == 404

    async def test_auto_appends_md_extension(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        md_file = repo_path / "page.md"
        md_file.write_text("content")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
            patch("app.routers.articles.frontmatter_service") as mock_fm,
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
            }
            mock_fm.parse_article.return_value = (
                {
                    "title": "Page",
                    "author": None,
                    "created_at": None,
                    "updated_at": None,
                    "updated_by": None,
                },
                "content",
            )
            # Request without .md extension
            resp = await client.get(f"{BASE}/articles/page", headers=AUTH_HEADER)

        assert resp.status_code == 200
        assert resp.json()["path"] == "page.md"

    async def test_binary_file_returns_placeholder_content(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        binary_file = repo_path / "image.png"
        binary_file.write_bytes(b"\x89PNG")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
            }
            resp = await client.get(f"{BASE}/articles/image.png", headers=AUTH_HEADER)

        assert resp.status_code == 200
        assert "binary" in resp.json()["content"].lower()

    async def test_path_traversal_returns_400(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
            }
            # Use URL-encoded ".." (%2e%2e) so httpx doesn't normalize the path
            resp = await client.get(
                f"{BASE}/articles/%2e%2e/etc/passwd", headers=AUTH_HEADER
            )
        assert resp.status_code == 400

    async def test_plain_text_file_returns_content(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        txt_file = repo_path / "notes.txt"
        txt_file.write_text("plain text notes")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
            }
            resp = await client.get(f"{BASE}/articles/notes.txt", headers=AUTH_HEADER)
        assert resp.status_code == 200
        assert resp.json()["content"] == "plain text notes"


class TestCreateArticle:
    """Tests for POST /repositories/{id}/articles."""

    async def test_creates_article_successfully(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
            patch("app.routers.articles.frontmatter_service") as mock_fm,
            patch("app.routers.article_helpers.SearchService"),
            patch("app.routers.articles.get_git_service") as mock_git_fn,
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
                "name": "test-repo",
            }
            mock_fm.create_frontmatter.return_value = "---\ntitle: New\n---\nHello"
            mock_fm.parse_article.return_value = (
                {
                    "title": "New",
                    "author": "admin@example.com",
                    "created_at": None,
                    "updated_at": None,
                    "updated_by": None,
                },
                "Hello",
            )
            mock_git = MagicMock()
            mock_git_fn.return_value = mock_git

            resp = await client.post(
                f"{BASE}/articles",
                json={"path": "new-article.md", "content": "Hello", "title": "New"},
                headers=AUTH_HEADER,
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "New"
        assert data["path"] == "new-article.md"

    async def test_read_only_repo_returns_403(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": True,
            }
            resp = await client.post(
                f"{BASE}/articles",
                json={"path": "new.md", "content": "test"},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 403

    async def test_duplicate_article_returns_400(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        (repo_path / "existing.md").write_text("exists")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
            }
            resp = await client.post(
                f"{BASE}/articles",
                json={"path": "existing.md", "content": "test"},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 400


class TestUpdateArticle:
    """Tests for PUT /repositories/{id}/articles/{path}."""

    async def test_updates_article_successfully(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        (repo_path / "test.md").write_text("old content")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
            patch("app.routers.articles.frontmatter_service") as mock_fm,
            patch("app.routers.article_helpers.SearchService"),
            patch("app.routers.articles.get_git_service") as mock_git_fn,
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
                "name": "test-repo",
            }
            mock_fm.update_frontmatter.return_value = "---\ntitle: Test\n---\nUpdated"
            mock_fm.parse_article.return_value = (
                {
                    "title": "Test",
                    "author": None,
                    "created_at": None,
                    "updated_at": None,
                    "updated_by": "admin@example.com",
                },
                "Updated",
            )
            mock_git = MagicMock()
            mock_git_fn.return_value = mock_git

            resp = await client.put(
                f"{BASE}/articles/test.md",
                json={"content": "Updated"},
                headers=AUTH_HEADER,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "Updated"

    async def test_update_nonexistent_returns_404(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
            }
            resp = await client.put(
                f"{BASE}/articles/missing.md",
                json={"content": "test"},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 404

    async def test_update_read_only_returns_403(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": True,
            }
            resp = await client.put(
                f"{BASE}/articles/test.md",
                json={"content": "test"},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 403


class TestDeleteArticle:
    """Tests for DELETE /repositories/{id}/articles/{path}."""

    async def test_deletes_article_successfully(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        article = repo_path / "doomed.md"
        article.write_text("content")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
            }
            resp = await client.delete(
                f"{BASE}/articles/doomed.md", headers=AUTH_HEADER
            )

        assert resp.status_code == 204
        assert not article.exists()

    async def test_delete_nonexistent_returns_404(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
            }
            resp = await client.delete(
                f"{BASE}/articles/missing.md", headers=AUTH_HEADER
            )
        assert resp.status_code == 404

    async def test_delete_read_only_returns_403(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": True,
            }
            resp = await client.delete(f"{BASE}/articles/test.md", headers=AUTH_HEADER)
        assert resp.status_code == 403


class TestMoveArticle:
    """Tests for POST /repositories/{id}/articles/{path}/move."""

    async def test_moves_article_successfully(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        old = repo_path / "old.md"
        old.write_text("content")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
            patch("app.routers.articles.frontmatter_service") as mock_fm,
            patch("app.routers.article_helpers.SearchService"),
            patch("app.routers.articles.get_git_service") as mock_git_fn,
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
                "name": "test-repo",
            }
            mock_fm.parse_article.return_value = (
                {
                    "title": "Old",
                    "author": None,
                    "created_at": None,
                    "updated_at": None,
                    "updated_by": None,
                },
                "content",
            )
            mock_git = MagicMock()
            mock_git.repo = MagicMock()
            mock_git_fn.return_value = mock_git

            resp = await client.post(
                f"{BASE}/articles/old.md/move",
                json={"new_path": "new.md"},
                headers=AUTH_HEADER,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["path"] == "new.md"

    async def test_move_nonexistent_returns_404(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
            }
            resp = await client.post(
                f"{BASE}/articles/missing.md/move",
                json={"new_path": "dest.md"},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 404

    async def test_move_to_existing_target_returns_400(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        (repo_path / "source.md").write_text("src")
        (repo_path / "target.md").write_text("tgt")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
            }
            resp = await client.post(
                f"{BASE}/articles/source.md/move",
                json={"new_path": "target.md"},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 400

    async def test_move_read_only_returns_403(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": True,
            }
            resp = await client.post(
                f"{BASE}/articles/test.md/move",
                json={"new_path": "new.md"},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 403


class TestServeFile:
    """Tests for GET /repositories/{id}/{path} (catch-all file serving)."""

    async def test_serve_markdown_as_article(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        (repo_path / "readme.md").write_text("# Readme")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
            patch("app.routers.articles.frontmatter_service") as mock_fm,
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
            }
            mock_fm.parse_article.return_value = (
                {
                    "title": "Readme",
                    "author": None,
                    "created_at": None,
                    "updated_at": None,
                    "updated_by": None,
                },
                "# Readme",
            )
            resp = await client.get(f"{BASE}/readme.md", headers=AUTH_HEADER)

        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Readme"

    async def test_serve_nonexistent_returns_404(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
            }
            resp = await client.get(f"{BASE}/nonexistent.xyz", headers=AUTH_HEADER)
        assert resp.status_code == 404

    async def test_disabled_repo_returns_403(self, client, tmp_path):
        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.articles.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": False,
                "local_path": str(tmp_path),
            }
            resp = await client.get(f"{BASE}/articles/test.md", headers=AUTH_HEADER)
        assert resp.status_code == 403

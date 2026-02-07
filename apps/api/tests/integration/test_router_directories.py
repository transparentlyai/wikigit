"""Integration tests for the directories router.

Tests endpoints under /repositories/{repository_id}/directories.
"""

from unittest.mock import patch, MagicMock

from tests.integration.conftest import AUTH_HEADER

REPO_ID = "owner-test-repo"
BASE = f"/repositories/{REPO_ID}"


class TestGetDirectories:
    """Tests for GET /repositories/{id}/directories."""

    async def test_returns_empty_tree_for_empty_repo(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
            }
            resp = await client.get(f"{BASE}/directories", headers=AUTH_HEADER)

        assert resp.status_code == 200
        data = resp.json()
        assert data["tree"] == []

    async def test_returns_tree_with_files_and_dirs(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        (repo_path / "readme.md").write_text("# Readme")
        subdir = repo_path / "guides"
        subdir.mkdir()
        (subdir / "install.md").write_text("# Install")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
            }
            resp = await client.get(f"{BASE}/directories", headers=AUTH_HEADER)

        assert resp.status_code == 200
        tree = resp.json()["tree"]
        # Files first, then directories
        names = [node["name"] for node in tree]
        assert "readme.md" in names
        assert "guides" in names
        # Files should come before directories
        file_idx = names.index("readme.md")
        dir_idx = names.index("guides")
        assert file_idx < dir_idx

    async def test_hidden_files_excluded(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        (repo_path / ".git").mkdir()
        (repo_path / ".hidden").write_text("hidden")
        (repo_path / "visible.md").write_text("visible")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
            }
            resp = await client.get(f"{BASE}/directories", headers=AUTH_HEADER)

        tree = resp.json()["tree"]
        names = [node["name"] for node in tree]
        assert ".git" not in names
        assert ".hidden" not in names
        assert "visible.md" in names

    async def test_unauthenticated_returns_401(self, client):
        resp = await client.get(f"{BASE}/directories")
        assert resp.status_code == 401


class TestCreateDirectory:
    """Tests for POST /repositories/{id}/directories."""

    async def test_creates_directory_with_gitkeep(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
            patch("app.routers.directories.get_git_service") as mock_git_fn,
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
            }
            mock_git = MagicMock()
            mock_git_fn.return_value = mock_git

            resp = await client.post(
                f"{BASE}/directories",
                json={"path": "new-dir"},
                headers=AUTH_HEADER,
            )

        assert resp.status_code == 201
        assert (repo_path / "new-dir").is_dir()
        assert (repo_path / "new-dir" / ".gitkeep").exists()

    async def test_create_existing_directory_returns_400(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        (repo_path / "existing").mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
            }
            resp = await client.post(
                f"{BASE}/directories",
                json={"path": "existing"},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 400

    async def test_create_directory_read_only_returns_403(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": True,
            }
            resp = await client.post(
                f"{BASE}/directories",
                json={"path": "new-dir"},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 403

    async def test_create_nested_directory(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
            patch("app.routers.directories.get_git_service") as mock_git_fn,
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
            }
            mock_git_fn.return_value = MagicMock()

            resp = await client.post(
                f"{BASE}/directories",
                json={"path": "deep/nested/dir"},
                headers=AUTH_HEADER,
            )

        assert resp.status_code == 201
        assert (repo_path / "deep" / "nested" / "dir").is_dir()


class TestDeleteDirectory:
    """Tests for DELETE /repositories/{id}/directories/{path}."""

    async def test_deletes_directory_successfully(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        target = repo_path / "to-delete"
        target.mkdir()
        (target / "file.md").write_text("content")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
            }
            resp = await client.delete(
                f"{BASE}/directories/to-delete", headers=AUTH_HEADER
            )

        assert resp.status_code == 204
        assert not target.exists()

    async def test_delete_nonexistent_returns_404(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
            }
            resp = await client.delete(
                f"{BASE}/directories/missing", headers=AUTH_HEADER
            )
        assert resp.status_code == 404

    async def test_delete_read_only_returns_403(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": True,
            }
            resp = await client.delete(
                f"{BASE}/directories/something", headers=AUTH_HEADER
            )
        assert resp.status_code == 403


class TestMoveDirectory:
    """Tests for POST /repositories/{id}/directories/{path}/move."""

    async def test_moves_directory_successfully(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        old_dir = repo_path / "old-dir"
        old_dir.mkdir()
        (old_dir / "file.md").write_text("content")

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
            patch("app.routers.article_helpers.SearchService"),
            patch("app.routers.directories.get_git_service") as mock_git_fn,
            patch("app.routers.directories.index_directory_articles"),
            patch("app.routers.directories.remove_directory_from_search_index"),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
                "name": "test-repo",
            }
            mock_git = MagicMock()
            mock_git.repo = MagicMock()
            mock_git_fn.return_value = mock_git

            resp = await client.post(
                f"{BASE}/directories/old-dir/move",
                json={"new_path": "new-dir"},
                headers=AUTH_HEADER,
            )

        assert resp.status_code == 204
        assert not old_dir.exists()
        assert (repo_path / "new-dir").is_dir()
        assert (repo_path / "new-dir" / "file.md").exists()

    async def test_move_nonexistent_returns_404(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
            }
            resp = await client.post(
                f"{BASE}/directories/missing/move",
                json={"new_path": "dest"},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 404

    async def test_move_to_existing_returns_400(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        (repo_path / "source").mkdir()
        (repo_path / "target").mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": False,
            }
            resp = await client.post(
                f"{BASE}/directories/source/move",
                json={"new_path": "target"},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 400

    async def test_move_read_only_returns_403(self, client, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()

        with (
            patch("app.routers.article_helpers.repository_service") as mock_rs,
            patch("app.routers.directories.repository_service", mock_rs),
        ):
            mock_rs.get_repository.return_value = {
                "id": REPO_ID,
                "enabled": True,
                "local_path": str(repo_path),
                "read_only": True,
            }
            resp = await client.post(
                f"{BASE}/directories/src/move",
                json={"new_path": "dst"},
                headers=AUTH_HEADER,
            )
        assert resp.status_code == 403

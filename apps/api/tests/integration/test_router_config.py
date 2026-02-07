"""Integration tests for the config router.

Tests endpoints under /config.
"""

from unittest.mock import patch

import yaml

from tests.integration.conftest import AUTH_HEADER, USER_HEADER


def _setup_config_file(tmp_path, config_data=None):
    """Create a fake __file__ and matching config.yaml for config update tests.

    The update_config function computes:
        config_file = Path(__file__).parent.parent.parent.parent.parent / "config.yaml"

    So with __file__ at depth/1/2/3/4/5/config.py, 5x parent = depth, and
    config.yaml should be at depth/config.yaml.

    Returns (fake_module_file_str, config_file_path).
    """
    if config_data is None:
        config_data = {
            "app": {
                "app_name": "WikiGit",
                "admins": ["admin@example.com"],
            },
            "search": {
                "index_dir": "/tmp/test-index",
            },
            "multi_repository": {
                "auto_sync_interval_minutes": 15,
                "author_name": "WikiGit Bot",
                "author_email": "bot@wikigit.app",
                "default_branch": "main",
                "repositories_root_dir": "/tmp/test-repos",
            },
        }

    # The code does: Path(__file__).parent.parent.parent.parent.parent / "config.yaml"
    # With file at root/1/2/3/4/5/config.py, parent^5 = root/1
    # So config.yaml must be at root/1/config.yaml
    project_root = tmp_path / "project_root"
    config_root = project_root / "1"
    fake_dir = config_root / "2" / "3" / "4" / "5"
    fake_dir.mkdir(parents=True, exist_ok=True)
    fake_file = fake_dir / "config.py"
    fake_file.touch()

    config_file = config_root / "config.yaml"
    config_file.write_text(yaml.safe_dump(config_data))

    return str(fake_file), config_file


class TestGetConfig:
    """Tests for GET /config."""

    async def test_admin_can_get_config(self, client, mock_settings):
        with patch("app.routers.config.settings", mock_settings):
            resp = await client.get("/config", headers=AUTH_HEADER)

        assert resp.status_code == 200
        data = resp.json()
        assert data["app_name"] == "WikiGit"
        assert data["admins"] == ["admin@example.com"]
        assert data["auto_sync_interval_minutes"] == 15
        assert data["author_name"] == "WikiGit Bot"
        assert data["author_email"] == "bot@wikigit.app"
        assert data["default_branch"] == "main"
        assert data["index_dir"] == "/tmp/test-index"
        assert data["home_page_repository"] is None
        assert data["home_page_article"] is None

    async def test_non_admin_returns_403(self, client, mock_settings):
        with patch("app.routers.config.settings", mock_settings):
            resp = await client.get("/config", headers=USER_HEADER)
        assert resp.status_code == 403

    async def test_unauthenticated_returns_401(self, client):
        resp = await client.get("/config")
        assert resp.status_code == 401


class TestUpdateConfig:
    """Tests for PUT /config."""

    async def test_admin_updates_app_settings(self, client, mock_settings, tmp_path):
        import app.routers.config as config_module

        fake_file, config_file = _setup_config_file(tmp_path)
        original_file = config_module.__file__

        try:
            with (
                patch("app.routers.config.settings", mock_settings),
                patch.object(config_module, "__file__", fake_file),
            ):
                resp = await client.put(
                    "/config",
                    json={"app": {"name": "NewName", "admins": ["admin@example.com"]}},
                    headers=AUTH_HEADER,
                )
        finally:
            config_module.__file__ = original_file

        assert resp.status_code == 200
        data = resp.json()
        assert data["app_name"] == "NewName"

    async def test_non_admin_cannot_update_config(self, client, mock_settings):
        with patch("app.routers.config.settings", mock_settings):
            resp = await client.put(
                "/config",
                json={"app": {"name": "Hacked"}},
                headers=USER_HEADER,
            )
        assert resp.status_code == 403

    async def test_update_config_no_config_file_returns_404(
        self, client, mock_settings, tmp_path
    ):
        import app.routers.config as config_module

        # Create fake module path but no config.yaml at the resolved target
        # With file at root/1/2/3/4/5/config.py, parent^5 = root/1
        # So it looks for root/1/config.yaml which we intentionally skip
        project_root = tmp_path / "no_config_root"
        config_root = project_root / "1"
        fake_dir = config_root / "2" / "3" / "4" / "5"
        fake_dir.mkdir(parents=True, exist_ok=True)
        fake_file = fake_dir / "config.py"
        fake_file.touch()
        # Do NOT create config_root/config.yaml

        original_file = config_module.__file__
        try:
            with (
                patch("app.routers.config.settings", mock_settings),
                patch.object(config_module, "__file__", str(fake_file)),
            ):
                resp = await client.put(
                    "/config",
                    json={"app": {"name": "Test"}},
                    headers=AUTH_HEADER,
                )
        finally:
            config_module.__file__ = original_file

        assert resp.status_code == 404

    async def test_update_multi_repository_settings(
        self, client, mock_settings, tmp_path
    ):
        import app.routers.config as config_module

        fake_file, config_file = _setup_config_file(tmp_path)
        original_file = config_module.__file__

        try:
            with (
                patch("app.routers.config.settings", mock_settings),
                patch.object(config_module, "__file__", fake_file),
            ):
                resp = await client.put(
                    "/config",
                    json={
                        "multi_repository": {
                            "auto_sync_interval_minutes": 30,
                            "author_name": "New Bot",
                        }
                    },
                    headers=AUTH_HEADER,
                )
        finally:
            config_module.__file__ = original_file

        assert resp.status_code == 200
        data = resp.json()
        assert data["auto_sync_interval_minutes"] == 30
        assert data["author_name"] == "New Bot"

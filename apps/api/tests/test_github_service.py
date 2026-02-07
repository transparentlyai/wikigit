"""Tests for the GitHub API service."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.github_service import GitHubService


def _make_github_settings(
    token="test-token", user_id="test-user", token_env_var="GITHUB_TOKEN"
):
    """Create a mock GitHubSettings object."""
    settings = MagicMock()
    settings.token = token
    settings.user_id = user_id
    settings.token_env_var = token_env_var
    return settings


def _make_repo_data(
    name="test-repo",
    owner="test-owner",
    private=False,
    description="A test repository",
    default_branch="main",
    clone_url=None,
):
    """Create a mock GitHub API repository response dict."""
    return {
        "name": name,
        "full_name": f"{owner}/{name}",
        "owner": {"login": owner},
        "private": private,
        "description": description,
        "default_branch": default_branch,
        "clone_url": clone_url or f"https://github.com/{owner}/{name}.git",
        "updated_at": "2025-01-01T00:00:00Z",
    }


# ============================================================================
# _build_headers
# ============================================================================


class TestBuildHeaders:
    """Tests for header construction."""

    def test_includes_auth_when_token_present(self):
        gh_settings = _make_github_settings(token="ghp_abc123")
        service = GitHubService(gh_settings)

        assert "Authorization" in service.headers
        assert service.headers["Authorization"] == "Bearer ghp_abc123"

    def test_no_auth_when_no_token(self):
        gh_settings = _make_github_settings(token=None)
        service = GitHubService(gh_settings)

        assert "Authorization" not in service.headers

    def test_includes_accept_header(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)

        assert service.headers["Accept"] == "application/vnd.github.v3+json"

    def test_includes_user_agent(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)

        assert "User-Agent" in service.headers
        assert "WikiGit" in service.headers["User-Agent"]


# ============================================================================
# _parse_repository
# ============================================================================


class TestParseRepository:
    """Tests for parsing GitHub API response data."""

    def test_extracts_correct_fields(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)
        data = _make_repo_data(name="wiki", owner="org", private=True)

        repo = service._parse_repository(data)

        assert repo.full_name == "org/wiki"
        assert repo.name == "wiki"
        assert repo.private is True
        assert repo.clone_url == "https://github.com/org/wiki.git"
        assert repo.description == "A test repository"

    def test_handles_missing_description(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)
        data = _make_repo_data()
        data["description"] = None

        repo = service._parse_repository(data)
        assert repo.description is None

    def test_raises_on_missing_required_field(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)
        data = _make_repo_data()
        del data["name"]  # Remove required field

        with pytest.raises(KeyError):
            service._parse_repository(data)


# ============================================================================
# fetch_user_repositories
# ============================================================================


class TestFetchUserRepositories:
    """Tests for fetching user repositories."""

    async def test_fetch_authenticated_user_repos(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [_make_repo_data()]
        mock_response.raise_for_status = MagicMock()
        mock_response.headers = {}

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(
                return_value=mock_client
            )
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)

            repos = await service.fetch_user_repositories()

            assert len(repos) == 1
            assert repos[0].name == "test-repo"
            # Verify the correct endpoint was called
            call_args = mock_client.get.call_args
            assert "/user/repos" in call_args[0][0]

    async def test_fetch_specific_username_repos(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [_make_repo_data(owner="someone")]
        mock_response.raise_for_status = MagicMock()
        mock_response.headers = {}

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(
                return_value=mock_client
            )
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)

            await service.fetch_user_repositories(username="someone")

            call_args = mock_client.get.call_args
            assert "/users/someone/repos" in call_args[0][0]


# ============================================================================
# fetch_organization_repositories
# ============================================================================


class TestFetchOrganizationRepositories:
    """Tests for fetching organization repositories."""

    async def test_fetch_org_repos(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            _make_repo_data(name="repo1", owner="my-org"),
            _make_repo_data(name="repo2", owner="my-org"),
        ]
        mock_response.raise_for_status = MagicMock()
        mock_response.headers = {}

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(
                return_value=mock_client
            )
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)

            repos = await service.fetch_organization_repositories("my-org")

            assert len(repos) == 2
            call_args = mock_client.get.call_args
            assert "/orgs/my-org/repos" in call_args[0][0]


# ============================================================================
# _fetch_paginated_repositories (pagination behavior)
# ============================================================================


class TestPagination:
    """Tests for pagination handling in _fetch_paginated_repositories."""

    async def test_handles_pagination_via_link_header(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)

        page1_response = MagicMock()
        page1_response.status_code = 200
        page1_response.json.return_value = [_make_repo_data(name="repo1")]
        page1_response.raise_for_status = MagicMock()
        page1_response.headers = {
            "Link": '<https://api.github.com/next?page=2>; rel="next"'
        }

        page2_response = MagicMock()
        page2_response.status_code = 200
        page2_response.json.return_value = [_make_repo_data(name="repo2")]
        page2_response.raise_for_status = MagicMock()
        page2_response.headers = {}

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(
                return_value=mock_client
            )
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(side_effect=[page1_response, page2_response])

            repos = await service._fetch_paginated_repositories(
                "https://api.github.com/user/repos",
                params={"per_page": 100},
            )

            assert len(repos) == 2
            assert repos[0].name == "repo1"
            assert repos[1].name == "repo2"

    async def test_handles_empty_response_end_of_pages(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = []
        mock_response.raise_for_status = MagicMock()
        mock_response.headers = {}

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(
                return_value=mock_client
            )
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)

            repos = await service._fetch_paginated_repositories(
                "https://api.github.com/user/repos",
                params={"per_page": 100},
            )

            assert repos == []


# ============================================================================
# get_repository_info
# ============================================================================


class TestGetRepositoryInfo:
    """Tests for getting info about a specific repository."""

    async def test_returns_repo_when_found(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = _make_repo_data(
            name="my-wiki", owner="testuser"
        )
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(
                return_value=mock_client
            )
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)

            repo = await service.get_repository_info("testuser", "my-wiki")

            assert repo is not None
            assert repo.name == "my-wiki"
            assert repo.full_name == "testuser/my-wiki"

    async def test_returns_none_for_404(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)

        mock_response = MagicMock()
        mock_response.status_code = 404

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(
                return_value=mock_client
            )
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)

            repo = await service.get_repository_info("testuser", "nonexistent")
            assert repo is None


# ============================================================================
# HTTP error handling
# ============================================================================


class TestHTTPErrorHandling:
    """Tests for HTTP error handling in paginated fetch."""

    async def test_401_raises_http_status_error(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)

        mock_request = httpx.Request("GET", "https://api.github.com/user/repos")
        mock_response = httpx.Response(401, request=mock_request)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(
                return_value=mock_client
            )
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)

            with pytest.raises(httpx.HTTPStatusError):
                await service._fetch_paginated_repositories(
                    "https://api.github.com/user/repos",
                    params={"per_page": 100},
                )

    async def test_403_raises_http_status_error(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)

        mock_request = httpx.Request("GET", "https://api.github.com/user/repos")
        mock_response = httpx.Response(403, request=mock_request)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(
                return_value=mock_client
            )
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)

            with pytest.raises(httpx.HTTPStatusError):
                await service._fetch_paginated_repositories(
                    "https://api.github.com/user/repos",
                    params={"per_page": 100},
                )

    async def test_404_raises_http_status_error(self):
        gh_settings = _make_github_settings()
        service = GitHubService(gh_settings)

        mock_request = httpx.Request("GET", "https://api.github.com/orgs/invalid/repos")
        mock_response = httpx.Response(404, request=mock_request)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__ = AsyncMock(
                return_value=mock_client
            )
            mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)

            with pytest.raises(httpx.HTTPStatusError):
                await service._fetch_paginated_repositories(
                    "https://api.github.com/orgs/invalid/repos",
                    params={"per_page": 100},
                )

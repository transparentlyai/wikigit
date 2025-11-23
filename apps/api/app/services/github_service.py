"""
GitHub API service for repository discovery and management.

This module provides integration with the GitHub API to:
- Fetch user repositories
- Fetch organization repositories
- Handle pagination for large repository lists
- Authenticate using GitHub Personal Access Token (PAT)
"""

import logging
from typing import List, Optional

import httpx

from app.config.settings import GitHubSettings
from app.models.schemas import GitHubRepository

logger = logging.getLogger(__name__)


class GitHubService:
    """Service for interacting with GitHub API."""

    GITHUB_API_BASE = "https://api.github.com"
    DEFAULT_PER_PAGE = 100  # Maximum allowed by GitHub API

    def __init__(self, github_settings: GitHubSettings):
        """
        Initialize GitHub service.

        Args:
            github_settings: GitHub configuration settings with PAT token
        """
        self.settings = github_settings
        self.headers = self._build_headers()

    def _build_headers(self) -> dict:
        """
        Build authentication headers for GitHub API requests.

        Returns:
            Dictionary of headers including authorization
        """
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "WikiGit-MultiRepo/1.0",
        }

        if self.settings.token:
            # Don't log the actual token for security
            headers["Authorization"] = f"Bearer {self.settings.token}"
            logger.debug("GitHub API headers configured with authentication token")
        else:
            logger.warning(
                "No GitHub token configured, API rate limits will be restricted"
            )

        return headers

    async def fetch_user_repositories(
        self,
        username: Optional[str] = None,
        include_private: bool = True,
    ) -> List[GitHubRepository]:
        """
        Fetch repositories for the authenticated user or a specific user.

        Args:
            username: GitHub username (None for authenticated user)
            include_private: Whether to include private repositories (requires auth)

        Returns:
            List of GitHubRepository objects

        Raises:
            httpx.HTTPError: If API request fails
        """
        try:
            if username:
                # Fetch public repos for a specific user
                endpoint = f"{self.GITHUB_API_BASE}/users/{username}/repos"
                logger.info(f"Fetching public repositories for user: {username}")
            else:
                # Fetch repos for authenticated user (includes private if authorized)
                endpoint = f"{self.GITHUB_API_BASE}/user/repos"
                logger.info("Fetching repositories for authenticated user")

            repositories = await self._fetch_paginated_repositories(
                endpoint,
                params={
                    "type": "all" if include_private else "public",
                    "sort": "updated",
                    "direction": "desc",
                    "per_page": self.DEFAULT_PER_PAGE,
                },
            )

            logger.info(f"Fetched {len(repositories)} repositories from GitHub")
            return repositories

        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch user repositories: {e}")
            raise

    async def fetch_organization_repositories(
        self, org_name: str
    ) -> List[GitHubRepository]:
        """
        Fetch all repositories for a GitHub organization.

        Args:
            org_name: GitHub organization name

        Returns:
            List of GitHubRepository objects

        Raises:
            httpx.HTTPError: If API request fails
        """
        try:
            endpoint = f"{self.GITHUB_API_BASE}/orgs/{org_name}/repos"
            logger.info(f"Fetching repositories for organization: {org_name}")

            repositories = await self._fetch_paginated_repositories(
                endpoint,
                params={
                    "type": "all",
                    "sort": "updated",
                    "direction": "desc",
                    "per_page": self.DEFAULT_PER_PAGE,
                },
            )

            logger.info(
                f"Fetched {len(repositories)} repositories from organization '{org_name}'"
            )
            return repositories

        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch organization repositories: {e}")
            raise

    async def _fetch_paginated_repositories(
        self, endpoint: str, params: dict
    ) -> List[GitHubRepository]:
        """
        Fetch repositories from GitHub API with pagination support.

        GitHub API returns results in pages. This method follows pagination
        links to retrieve all repositories.

        Args:
            endpoint: API endpoint URL
            params: Query parameters for the request

        Returns:
            List of all repositories across all pages

        Raises:
            httpx.HTTPError: If API request fails
        """
        all_repositories = []
        page = 1

        async with httpx.AsyncClient() as client:
            while True:
                # Add page number to params
                paginated_params = {**params, "page": page}

                logger.debug(f"Fetching page {page} from {endpoint}")

                try:
                    response = await client.get(
                        endpoint,
                        headers=self.headers,
                        params=paginated_params,
                        timeout=30.0,
                    )
                    response.raise_for_status()

                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 401:
                        logger.error(
                            "GitHub API authentication failed - invalid or missing token"
                        )
                    elif e.response.status_code == 403:
                        logger.error(
                            "GitHub API rate limit exceeded or insufficient permissions"
                        )
                    elif e.response.status_code == 404:
                        logger.error(f"GitHub API endpoint not found: {endpoint}")
                    else:
                        logger.error(
                            f"GitHub API request failed with status {e.response.status_code}"
                        )
                    raise

                except httpx.RequestError as e:
                    logger.error(f"GitHub API request error: {e}")
                    raise

                # Parse response
                repos_data = response.json()

                # Empty response means we've reached the last page
                if not repos_data:
                    break

                # Convert to GitHubRepository objects
                for repo_data in repos_data:
                    try:
                        all_repositories.append(self._parse_repository(repo_data))
                    except Exception as e:
                        logger.warning(
                            f"Failed to parse repository {repo_data.get('full_name', 'unknown')}: {e}"
                        )
                        continue

                # Check if there are more pages
                # GitHub API includes pagination info in Link header
                link_header = response.headers.get("Link", "")
                if 'rel="next"' not in link_header:
                    # No more pages
                    break

                page += 1

        return all_repositories

    def _parse_repository(self, repo_data: dict) -> GitHubRepository:
        """
        Parse GitHub API repository data into GitHubRepository model.

        Args:
            repo_data: Raw repository data from GitHub API

        Returns:
            GitHubRepository object

        Raises:
            KeyError: If required fields are missing
        """
        return GitHubRepository(
            owner=repo_data["owner"]["login"],
            name=repo_data["name"],
            full_name=repo_data["full_name"],
            description=repo_data.get("description"),
            private=repo_data["private"],
            default_branch=repo_data.get("default_branch", "main"),
            clone_url=repo_data["clone_url"],
            updated_at=repo_data.get("updated_at"),
        )

    async def get_repository_info(
        self, owner: str, repo: str
    ) -> Optional[GitHubRepository]:
        """
        Get information about a specific repository.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            GitHubRepository object or None if not found

        Raises:
            httpx.HTTPError: If API request fails
        """
        try:
            endpoint = f"{self.GITHUB_API_BASE}/repos/{owner}/{repo}"
            logger.info(f"Fetching repository info for {owner}/{repo}")

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    endpoint,
                    headers=self.headers,
                    timeout=30.0,
                )

                if response.status_code == 404:
                    logger.warning(f"Repository {owner}/{repo} not found")
                    return None

                response.raise_for_status()
                repo_data = response.json()

                return self._parse_repository(repo_data)

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            logger.error(f"Failed to fetch repository info: {e}")
            raise
        except httpx.RequestError as e:
            logger.error(f"GitHub API request error: {e}")
            raise

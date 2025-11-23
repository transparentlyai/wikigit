"""
Repositories router for multi-repository support.

This module implements the complete repository management API including:
- Scan GitHub user's repositories
- List all configured repositories
- Add/clone repositories from GitHub
- Update repository settings
- Sync repositories with remote
- Remove repositories

Phase 6: Multi-Repository Support
"""

import logging
import os
from pathlib import Path
from typing import List

import yaml
from fastapi import APIRouter, Depends, HTTPException, status

from app.config.settings import settings
from app.middleware.auth import get_current_user, require_admin
from app.models.schemas import (
    GitHubRepository,
    RepositoryListResponse,
    RepositoryStatus,
    RepositorySyncResponse,
)
from app.services import repository_service
from app.services.multi_repo_git_service import MultiRepoGitService
from app.services.search_service import SearchService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repositories", tags=["repositories"])


def trigger_search_reindex() -> None:
    """
    Trigger a full search index rebuild.

    Called when repositories are added, removed, or enabled/disabled
    to ensure search index stays in sync with repository changes.
    """
    try:
        search_service = SearchService(
            search_settings=settings.search,
            repo_path=settings.multi_repository.root_dir,
        )
        multi_repo_service = MultiRepoGitService()

        document_count = search_service.rebuild_index(
            multi_repo_service=multi_repo_service
        )
        logger.info(f"Search index rebuilt: {document_count} documents")
    except Exception as e:
        logger.error(f"Failed to rebuild search index: {e}")


@router.get("/scan", response_model=List[GitHubRepository])
async def scan_github_repositories(
    user_email: str = Depends(get_current_user),
) -> List[GitHubRepository]:
    """
    Scan GitHub user's accessible repositories.

    Requires GitHub token in configuration.
    Returns list of repositories accessible to the authenticated GitHub user.

    Args:
        user_email: Authenticated user email (from dependency)

    Returns:
        List of GitHub repositories

    Raises:
        HTTPException: 400 if no GitHub token configured
        HTTPException: 500 if GitHub API call fails
    """
    logger.info(f"GitHub repository scan requested by {user_email}")

    # Get GitHub token from multi_repository settings
    if not settings.multi_repository.github:
        logger.warning("GitHub settings not configured")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub not configured. Please configure GitHub settings in the admin panel.",
        )

    github_token = settings.multi_repository.github.token
    if not github_token:
        logger.warning("GitHub token not found in environment")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub token not found. Please set the {settings.multi_repository.github.token_env_var} environment variable.",
        )

    try:
        import httpx

        headers = {
            "Authorization": f"token {github_token}",
            "Accept": "application/vnd.github.v3+json",
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user/repos",
                headers=headers,
                params={"type": "all", "per_page": 100},
                timeout=10.0,
            )

            if response.status_code == 401:
                logger.error("GitHub authentication failed - invalid token")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid GitHub token",
                )

            if response.status_code != 200:
                logger.error(f"GitHub API error: {response.status_code}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to query GitHub API",
                )

            repos = response.json()
            github_repos = [
                GitHubRepository(
                    full_name=repo["full_name"],
                    name=repo["name"],
                    clone_url=repo["clone_url"],
                    private=repo["private"],
                    description=repo.get("description"),
                )
                for repo in repos
            ]

            logger.info(f"Found {len(github_repos)} repositories for user {user_email}")
            return github_repos

    except ImportError:
        logger.error("httpx library not installed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub scan not available",
        )
    except Exception as e:
        logger.error(f"GitHub scan failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scan GitHub: {str(e)}",
        )


@router.get("", response_model=RepositoryListResponse)
async def list_repositories(
    user_email: str = Depends(get_current_user),
) -> RepositoryListResponse:
    """List all configured repositories."""
    logger.info(f"Listing repositories for user {user_email}")

    repos = repository_service.list_repositories()
    repo_statuses = [
        repository_service.get_repository_status(repo["id"]) for repo in repos
    ]

    return RepositoryListResponse(
        repositories=repo_statuses,
        total=len(repo_statuses),
    )


@router.get("/{repository_id}", response_model=RepositoryStatus)
async def get_repository(
    repository_id: str,
    user_email: str = Depends(get_current_user),
) -> RepositoryStatus:
    """Get a specific repository by ID."""
    logger.info(f"Getting repository {repository_id} for user {user_email}")

    try:
        return repository_service.get_repository_status(repository_id)
    except ValueError as e:
        logger.warning(f"Repository not found: {repository_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def add_repositories(
    request: dict,
    user_email: str = Depends(get_current_user),
) -> None:
    """Add/clone repositories from GitHub."""
    logger.info(f"Add repositories request from {user_email}")

    repo_ids = request.get("repository_ids", [])
    if not repo_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="repository_ids list is required",
        )

    # Get GitHub token from multi_repository settings
    if not settings.multi_repository.github:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="GitHub not configured",
        )

    github_token = settings.multi_repository.github.token
    if not github_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub token not found. Please set the {settings.multi_repository.github.token_env_var} environment variable.",
        )

    try:
        import httpx

        headers = {
            "Authorization": f"token {github_token}",
            "Accept": "application/vnd.github.v3+json",
        }

        async with httpx.AsyncClient() as client:
            for full_name in repo_ids:
                try:
                    response = await client.get(
                        f"https://api.github.com/repos/{full_name}",
                        headers=headers,
                        timeout=10.0,
                    )

                    if response.status_code != 200:
                        logger.error(f"Failed to get repo info for {full_name}")
                        continue

                    repo_data = response.json()
                    repo_id = full_name.replace("/", "-").lower()
                    local_path = settings.multi_repository.root_dir / "repos" / repo_id

                    repository_service.clone_repository(
                        repo_id=repo_id,
                        remote_url=repo_data["clone_url"],
                        local_path=local_path,
                        name=repo_data["name"],
                        owner=repo_data["owner"]["login"],
                        default_branch=repo_data.get("default_branch", "main"),
                        github_token=github_token,  # Pass token for private repos
                    )

                    logger.info(f"Cloned repository {full_name}")

                except Exception as e:
                    logger.error(f"Failed to clone {full_name}: {e}")

        # Trigger search reindex after adding repositories
        trigger_search_reindex()

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Required dependencies not available",
        )
    except Exception as e:
        logger.error(f"Add repositories failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add repositories: {str(e)}",
        )


@router.put("/{repository_id}", response_model=RepositoryStatus)
async def update_repository(
    repository_id: str,
    update: dict,
    user_email: str = Depends(get_current_user),
) -> RepositoryStatus:
    """Update repository settings."""
    logger.info(f"Updating repository {repository_id} by {user_email}")

    try:
        # Check if enabled status is being changed
        should_reindex = "enabled" in update

        repository_service.update_repository(repository_id, update)

        # Trigger search reindex if enabled status changed
        if should_reindex:
            logger.info(
                f"Repository {repository_id} enabled status changed, triggering reindex"
            )
            trigger_search_reindex()

        return repository_service.get_repository_status(repository_id)
    except ValueError as e:
        logger.warning(f"Repository not found: {repository_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Failed to update repository {repository_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update repository: {str(e)}",
        )


@router.post("/{repository_id}/sync", response_model=RepositorySyncResponse)
async def sync_repository(
    repository_id: str,
    user_email: str = Depends(get_current_user),
) -> RepositorySyncResponse:
    """Sync a repository with its remote."""
    logger.info(f"Sync requested for repository {repository_id} by {user_email}")

    try:
        result = repository_service.sync_repository(
            repository_id,
            author_name=settings.multi_repository.author_name,
            author_email=settings.multi_repository.author_email,
        )

        return RepositorySyncResponse(
            repository_id=result["repository_id"],
            status=result["status"],
            message=result["message"],
            commits_pulled=result.get("commits_pulled", 0),
            commits_pushed=result.get("commits_pushed", 0),
            files_changed=result.get("files_changed", 0),
        )

    except ValueError as e:
        logger.warning(f"Repository not found: {repository_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Sync failed for repository {repository_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}",
        )


@router.delete("/{repository_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_repository(
    repository_id: str,
    user_email: str = Depends(get_current_user),
) -> None:
    """Remove a repository from the system."""
    logger.info(f"Remove repository {repository_id} requested by {user_email}")

    try:
        repository_service.remove_repository(repository_id)
        logger.info(f"Repository {repository_id} removed successfully")

        # Trigger search reindex to remove all articles from deleted repository
        trigger_search_reindex()

    except ValueError as e:
        logger.warning(f"Repository not found: {repository_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Failed to remove repository {repository_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove repository: {str(e)}",
        )


@router.get("/github/settings", status_code=status.HTTP_200_OK)
async def get_github_settings(_admin: str = Depends(require_admin)) -> dict:
    """
    Get current GitHub settings.

    Returns:
        GitHub settings (user_id and token_env_var)
    """
    if settings.multi_repository.github:
        return {
            "user_id": settings.multi_repository.github.user_id or "",
            "token_env_var": settings.multi_repository.github.token_env_var
            or "GITHUB_TOKEN",
        }
    return {
        "user_id": "",
        "token_env_var": "GITHUB_TOKEN",
    }


@router.post("/github/test", status_code=status.HTTP_200_OK)
async def test_github_connection(
    request: dict,
    _admin: str = Depends(require_admin),
) -> dict:
    """
    Test GitHub connection with provided credentials.

    Args:
        request: Dict containing 'token_env_var' and 'user_id'

    Returns:
        Success status and user info if connection successful

    Raises:
        HTTPException: 400 if credentials invalid
    """
    token_env_var = request.get("token_env_var", "GITHUB_TOKEN")
    user_id = request.get("user_id", "")

    logger.info(f"Testing GitHub connection for user {user_id}")

    # Get token from environment
    github_token = os.environ.get(token_env_var)
    if not github_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Environment variable {token_env_var} not set",
        )

    try:
        import httpx

        headers = {
            "Authorization": f"token {github_token}",
            "Accept": "application/vnd.github.v3+json",
        }

        # Test by fetching authenticated user info
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user",
                headers=headers,
                timeout=10.0,
            )

            if response.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid GitHub token - authentication failed",
                )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"GitHub API error: {response.status_code}",
                )

            user_data = response.json()
            logger.info(f"GitHub connection successful for {user_data.get('login')}")

            return {
                "success": True,
                "message": f"Connected successfully as {user_data.get('login')}",
                "user": {
                    "login": user_data.get("login"),
                    "name": user_data.get("name"),
                    "email": user_data.get("email"),
                },
            }

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="httpx library not installed",
        )
    except Exception as e:
        logger.error(f"GitHub connection test failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test GitHub connection: {str(e)}",
        )


@router.post("/github/settings", status_code=status.HTTP_200_OK)
async def save_github_settings(
    request: dict,
    _admin: str = Depends(require_admin),
) -> dict:
    """
    Save GitHub settings to config.yaml.

    Args:
        request: Dict containing 'token_env_var' and 'user_id'

    Returns:
        Success message

    Raises:
        HTTPException: 500 if config update fails
    """
    token_env_var = request.get("token_env_var", "GITHUB_TOKEN")
    user_id = request.get("user_id", "")

    logger.info(f"Saving GitHub settings for user {user_id}")

    try:
        # Get config file path
        config_file = Path(__file__).parent.parent.parent.parent.parent / "config.yaml"

        if not config_file.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration file not found at {config_file}",
            )

        # Read current config
        with open(config_file, "r") as f:
            config_data = yaml.safe_load(f)

        # Ensure multi_repository section exists
        if "multi_repository" not in config_data:
            config_data["multi_repository"] = {
                "enabled": False,
                "repositories_root_dir": "/home/mauro/projects/wiki-repositories",
                "auto_sync_interval_minutes": 15,
                "github": {},
                "repositories": [],
            }

        # Update GitHub settings
        if "github" not in config_data["multi_repository"]:
            config_data["multi_repository"]["github"] = {}

        config_data["multi_repository"]["github"]["token_env_var"] = token_env_var
        config_data["multi_repository"]["github"]["user_id"] = user_id

        # Write updated config
        with open(config_file, "w") as f:
            yaml.safe_dump(config_data, f, default_flow_style=False)

        # Update in-memory settings immediately
        from app.config.settings import GitHubSettings

        if (
            not hasattr(settings.multi_repository, "github")
            or settings.multi_repository.github is None
        ):
            settings.multi_repository.github = GitHubSettings(
                token_env_var=token_env_var, user_id=user_id
            )
        else:
            settings.multi_repository.github.token_env_var = token_env_var
            settings.multi_repository.github.user_id = user_id

        logger.info("GitHub settings saved and reloaded successfully")

        return {
            "success": True,
            "message": "GitHub settings saved successfully. You can now scan repositories.",
        }

    except Exception as e:
        logger.error(f"Failed to save GitHub settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save settings: {str(e)}",
        )

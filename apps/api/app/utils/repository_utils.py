"""
Utility functions for multi-repository support.
"""

from pathlib import Path
from typing import Optional

from fastapi import HTTPException, status

from app.config.settings import settings
from app.services.repository_service import RepositoryService


# Path to repositories configuration
REPOS_CONFIG_PATH = settings.repository.repo_path / "config" / "repositories.json"
repository_service = RepositoryService(REPOS_CONFIG_PATH)


def get_repository_path(repo_id: Optional[str] = None) -> Path:
    """
    Get the path to a repository.

    In single-repository mode (repo_id is None), returns the configured repo_path.
    In multi-repository mode, returns the path to the specified repository.

    Args:
        repo_id: Repository identifier (None for single-repository mode)

    Returns:
        Path to the repository

    Raises:
        HTTPException: If repository not found in multi-repository mode
    """
    if repo_id is None:
        # Single-repository mode
        return settings.repository.repo_path

    # Multi-repository mode
    try:
        repo = repository_service.get_repository(repo_id)
        return Path(repo["local_path"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )


def check_repository_writable(repo_id: Optional[str] = None) -> None:
    """
    Check if a repository is writable (not read-only).

    Args:
        repo_id: Repository identifier (None for single-repository mode)

    Raises:
        HTTPException: If repository is read-only
    """
    if repo_id is None:
        # Single-repository mode - always writable
        return

    # Multi-repository mode - check read_only flag
    try:
        repo = repository_service.get_repository(repo_id)
        if repo.get("read_only", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Repository is read-only: {repo_id}",
            )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )


def get_repository_info(repo_id: Optional[str] = None) -> dict:
    """
    Get repository information.

    Args:
        repo_id: Repository identifier (None for single-repository mode)

    Returns:
        Dictionary with repository info (id, name, etc.)

    Raises:
        HTTPException: If repository not found in multi-repository mode
    """
    if repo_id is None:
        # Single-repository mode
        return {
            "id": "default",
            "name": settings.app.name,
            "read_only": False,
        }

    # Multi-repository mode
    try:
        return repository_service.get_repository(repo_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )

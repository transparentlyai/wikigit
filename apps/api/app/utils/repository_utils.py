"""
Utility functions for multi-repository support.
"""

from pathlib import Path

from fastapi import HTTPException, status

from app.services import repository_service


def get_repository_path(repo_id: str) -> Path:
    """
    Get the path to a repository.

    Args:
        repo_id: Repository identifier

    Returns:
        Path to the repository

    Raises:
        HTTPException: If repository not found
    """
    try:
        repo = repository_service.get_repository(repo_id)
        return Path(repo["local_path"])
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )


def check_repository_writable(repo_id: str) -> None:
    """
    Check if a repository is writable (not read-only).

    Args:
        repo_id: Repository identifier

    Raises:
        HTTPException: If repository is read-only or not found
    """
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


def get_repository_info(repo_id: str) -> dict:
    """
    Get repository information.

    Args:
        repo_id: Repository identifier

    Returns:
        Dictionary with repository info (id, name, etc.)

    Raises:
        HTTPException: If repository not found
    """
    try:
        return repository_service.get_repository(repo_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository not found: {repo_id}",
        )

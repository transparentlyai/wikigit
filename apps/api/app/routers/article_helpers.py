"""Shared helpers for article and directory routers."""

import logging
from datetime import datetime
from pathlib import Path
from typing import List
from urllib.parse import unquote

from fastapi import HTTPException, status

from app.config.settings import settings
from app.services import frontmatter_service, repository_service
from app.services.git_service import GitService
from app.services.search_service import SearchService

logger = logging.getLogger(__name__)

BINARY_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".mp4",
    ".mp3",
    ".wav",
    ".mov",
    ".avi",
    ".webm",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".class",
    ".pyc",
}


def get_repository_path(repository_id: str) -> Path:
    """
    Get the local filesystem path for a repository.

    Args:
        repository_id: Repository identifier

    Returns:
        Path to the repository directory

    Raises:
        HTTPException: 404 if repository not found or not enabled
    """
    try:
        repo_meta = repository_service.get_repository(repository_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repository_id}' not found",
        )

    if not repo_meta.get("enabled", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Repository '{repository_id}' is not enabled",
        )

    local_path = Path(repo_meta["local_path"])
    if not local_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{repository_id}' not found on disk. Please sync it first.",
        )

    return local_path


def get_git_service(repository_id: str) -> GitService:
    """
    Get a GitService instance for a repository.

    Args:
        repository_id: Repository identifier

    Returns:
        GitService instance for the repository

    Raises:
        HTTPException: If repository not found or not configured
    """
    repo_path = get_repository_path(repository_id)
    repo_meta = repository_service.get_repository(repository_id)

    return GitService(
        repo_path=repo_path,
        author_name="WikiGit",
        author_email="wikigit@example.com",
        remote_url=repo_meta.get("remote_url"),
        auto_push=True,  # Enable auto-push for manual push operations
    )


def validate_path(path: str) -> str:
    """
    Validate and sanitize a file/directory path.

    Args:
        path: Path to validate

    Returns:
        Sanitized path

    Raises:
        HTTPException: 400 if path is invalid
    """
    # Decode URL encoding
    path = unquote(path)

    # Prevent path traversal
    if ".." in path or path.startswith("/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid path: path traversal not allowed",
        )

    return path


def normalize_author_field(value) -> str | None:
    """
    Normalize author/updated_by field that might be a dict or string.

    Handles legacy frontmatter where author was a structured object.

    Args:
        value: Author value from frontmatter (string, dict, or None)

    Returns:
        Normalized string value or None
    """
    if value is None:
        return None
    if isinstance(value, dict):
        # Try to extract email or name from structured data
        return value.get("email") or value.get("name") or str(value)
    return str(value) if value else None


def get_search_service(repository_id: str) -> SearchService:
    """
    Get a SearchService instance for indexing operations.

    Args:
        repository_id: Repository identifier

    Returns:
        SearchService instance
    """
    repo_path = get_repository_path(repository_id)
    return SearchService(search_settings=settings.search, repo_path=repo_path)


def update_search_index(
    repository_id: str,
    path: str,
    title: str,
    content: str,
    author: str,
    created_at,
    updated_at,
    updated_by: str,
) -> None:
    """
    Update the search index for an article.

    Args:
        repository_id: Repository identifier
        path: Article path
        title: Article title
        content: Article content
        author: Original author
        created_at: Creation timestamp
        updated_at: Update timestamp
        updated_by: Last updater
    """
    try:
        search_service = get_search_service(repository_id)
        repo_meta = repository_service.get_repository(repository_id)

        search_service.index_article(
            path=f"{repository_id}:{path}",
            title=title,
            content=content,
            author=author,
            created_at=created_at,
            updated_at=updated_at,
            updated_by=updated_by,
            repository_id=repository_id,
            repository_name=repo_meta.get("name", repository_id),
        )
        logger.info(f"Updated search index for article: {repository_id}/{path}")
    except Exception as e:
        # Log error but don't fail the operation
        logger.error(f"Failed to update search index for {path}: {e}")


def remove_from_search_index(repository_id: str, path: str) -> None:
    """
    Remove an article from the search index.

    Args:
        repository_id: Repository identifier
        path: Article path
    """
    try:
        search_service = get_search_service(repository_id)

        # Create full path for multi-repo index (format: "owner/repo:path/to/file.md")
        indexed_path = f"{repository_id}:{path}"

        search_service.remove_article(indexed_path)
        logger.info(f"Removed article from search index: {indexed_path}")
    except Exception as e:
        # Log error but don't fail the operation
        logger.error(f"Failed to remove article from search index {path}: {e}")


def remove_directory_from_search_index(
    repository_id: str, directory_path: Path, repo_path: Path
) -> None:
    """
    Remove all files in a directory from the search index.

    Args:
        repository_id: Repository identifier
        directory_path: Absolute path to the directory
        repo_path: Repository root path
    """
    try:
        # Find all files in the directory
        for file_path in directory_path.rglob("*"):
            if file_path.is_file():
                # Get relative path from repo root
                rel_path = str(file_path.relative_to(repo_path))
                remove_from_search_index(repository_id, rel_path)
    except Exception as e:
        logger.error(f"Failed to remove directory from search index: {e}")


def index_directory_articles(
    repository_id: str, directory_path: Path, repo_path: Path
) -> None:
    """
    Index all files in a directory.

    Args:
        repository_id: Repository identifier
        directory_path: Absolute path to the directory
        repo_path: Repository root path
    """
    try:
        # Find all files in the directory
        for file_path in directory_path.rglob("*"):
            if file_path.is_file():
                # Get relative path from repo root
                rel_path = str(file_path.relative_to(repo_path))

                if file_path.suffix == ".md":
                    # Parse the article
                    metadata, content = frontmatter_service.parse_article(file_path)
                    title = metadata.get("title", file_path.stem)
                    author = normalize_author_field(metadata.get("author")) or ""
                    created_at = metadata.get("created_at")
                    updated_at = metadata.get("updated_at")
                    updated_by = (
                        normalize_author_field(metadata.get("updated_by")) or ""
                    )
                else:
                    # Index non-markdown files by filename
                    content = file_path.name
                    title = file_path.name
                    author = "system"
                    created_at = datetime.now()
                    updated_at = datetime.now()
                    updated_by = "system"

                # Index the article
                update_search_index(
                    repository_id=repository_id,
                    path=rel_path,
                    title=title,
                    content=content,
                    author=author,
                    created_at=created_at,
                    updated_at=updated_at,
                    updated_by=updated_by,
                )
    except Exception as e:
        logger.error(f"Failed to index directory articles: {e}")


def handle_background_deletion(
    repository_id: str,
    git_files: List[str],
    search_files: List[str],
    commit_message: str,
) -> None:
    """
    Handle Git operations and search index removal in the background.
    """
    # 1. Git operations
    try:
        if git_files:
            git_service = get_git_service(repository_id)
            if git_service.repo:
                # Remove files from git index
                git_service.repo.index.remove(git_files)
                git_service.repo.index.commit(commit_message)
                logger.info(f"Background: Committed deletion of {len(git_files)} files")

                # Push to remote
                git_service.push_to_remote()
                logger.info("Background: Pushed deletion to remote")
    except Exception as e:
        logger.error(f"Background git deletion failed: {e}")

    # 2. Search index operations
    try:
        for path in search_files:
            remove_from_search_index(repository_id, path)
        if search_files:
            logger.info(
                f"Background: Removed {len(search_files)} items from search index"
            )
    except Exception as e:
        logger.error(f"Background search deletion failed: {e}")

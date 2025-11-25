"""
Articles and directories router for multi-repository support.

This module implements the complete article and directory management API including:
- List articles in a repository
- Get, create, update, and delete articles
- Move/rename articles
- Get directory tree
- Create, delete, and move directories

Phase 6: Multi-Repository Support
"""

import logging
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import List
from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse

from app.config.settings import settings
from app.middleware.auth import get_current_user
from app.models.schemas import (
    Article,
    ArticleCreate,
    ArticleListResponse,
    ArticleMove,
    ArticleSummary,
    ArticleUpdate,
    DirectoryCreate,
    DirectoryNode,
    DirectoryTreeResponse,
)
from app.services import frontmatter_service, repository_service
from app.services.git_service import GitService
from app.services.search_service import SearchService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repositories/{repository_id}", tags=["articles"])

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
    Remove all markdown articles in a directory from the search index.

    Args:
        repository_id: Repository identifier
        directory_path: Absolute path to the directory
        repo_path: Repository root path
    """
    try:
        # Find all markdown files in the directory
        for md_file in directory_path.rglob("*.md"):
            if md_file.is_file():
                # Get relative path from repo root
                rel_path = str(md_file.relative_to(repo_path))
                remove_from_search_index(repository_id, rel_path)
    except Exception as e:
        logger.error(f"Failed to remove directory from search index: {e}")


def index_directory_articles(
    repository_id: str, directory_path: Path, repo_path: Path
) -> None:
    """
    Index all markdown articles in a directory.

    Args:
        repository_id: Repository identifier
        directory_path: Absolute path to the directory
        repo_path: Repository root path
    """
    try:
        # Find all markdown files in the directory
        for md_file in directory_path.rglob("*.md"):
            if md_file.is_file():
                # Get relative path from repo root
                rel_path = str(md_file.relative_to(repo_path))

                # Parse the article
                metadata, content = frontmatter_service.parse_article(md_file)

                # Index the article
                update_search_index(
                    repository_id=repository_id,
                    path=rel_path,
                    title=metadata.get("title", md_file.stem),
                    content=content,
                    author=normalize_author_field(metadata.get("author")) or "",
                    created_at=metadata.get("created_at"),
                    updated_at=metadata.get("updated_at"),
                    updated_by=normalize_author_field(metadata.get("updated_by")) or "",
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


# ============================================================================
# Article Endpoints
# ============================================================================


@router.get("/articles", response_model=ArticleListResponse)
async def list_articles(
    repository_id: str,
    user_email: str = Depends(get_current_user),
) -> ArticleListResponse:
    """
    List all articles in a repository.

    Returns article summaries (without full content) for all markdown files.

    Args:
        repository_id: Repository identifier
        user_email: Authenticated user email

    Returns:
        List of article summaries
    """
    logger.info(f"Listing articles for repository {repository_id} by {user_email}")

    repo_path = get_repository_path(repository_id)

    # Find all markdown files
    md_files = list(repo_path.rglob("*.md"))

    articles = []
    for md_file in md_files:
        try:
            # Get relative path from repository root
            relative_path = md_file.relative_to(repo_path)

            # Parse frontmatter to get metadata
            metadata, _ = frontmatter_service.parse_article(md_file)

            # Create article summary
            summary = ArticleSummary(
                path=str(relative_path),
                title=metadata.get("title", md_file.stem),
                author=normalize_author_field(metadata.get("author")),
                updated_at=metadata.get("updated_at"),
                updated_by=normalize_author_field(metadata.get("updated_by")),
            )
            articles.append(summary)

        except Exception as e:
            logger.warning(f"Failed to parse article {md_file}: {e}")
            # Skip files that can't be parsed

    logger.info(f"Found {len(articles)} articles in repository {repository_id}")
    return ArticleListResponse(articles=articles)


@router.get("/articles/{path:path}", response_model=Article)
async def get_article(
    repository_id: str,
    path: str,
    user_email: str = Depends(get_current_user),
) -> Article:
    """
    Get a specific article by path.

    Args:
        repository_id: Repository identifier
        path: Article path relative to repository root
        user_email: Authenticated user email

    Returns:
        Article with full content and metadata

    Raises:
        HTTPException: 404 if article not found
    """
    logger.info(
        f"Getting article {path} from repository {repository_id} by {user_email}"
    )

    repo_path = get_repository_path(repository_id)
    path = validate_path(path)

    # Auto-append .md only if no extension is present, for backward compatibility
    # But if it has an extension, respect it.
    if not Path(path).suffix and not (repo_path / path).exists():
        test_path = f"{path}.md"
        if (repo_path / test_path).exists():
            path = test_path

    article_path = repo_path / path

    if not article_path.exists() or not article_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Article '{path}' not found",
        )

    # Check if binary
    if article_path.suffix.lower() in BINARY_EXTENSIONS:
        return Article(
            path=path,
            title=article_path.name,
            content="This file is binary and cannot be displayed.",
            author=None,
            created_at=None,
            updated_at=None,
            updated_by=None,
        )

    try:
        # If markdown, parse frontmatter
        if article_path.suffix == ".md":
            metadata, content = frontmatter_service.parse_article(article_path)
            return Article(
                path=path,
                title=metadata.get("title", article_path.stem),
                content=content,
                author=normalize_author_field(metadata.get("author")),
                created_at=metadata.get("created_at"),
                updated_at=metadata.get("updated_at"),
                updated_by=normalize_author_field(metadata.get("updated_by")),
            )
        else:
            # For other text files, just read content
            content = article_path.read_text(encoding="utf-8")
            return Article(
                path=path,
                title=article_path.name,
                content=content,
                # No metadata for plain text files
                author=None,
                created_at=None,
                updated_at=None,
                updated_by=None,
            )

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File is not a valid text file: {path}",
        )
    except Exception as e:
        logger.error(f"Failed to read article {path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read article: {str(e)}",
        )


@router.post("/articles", response_model=Article, status_code=status.HTTP_201_CREATED)
async def create_article(
    repository_id: str,
    article_data: ArticleCreate,
    user_email: str = Depends(get_current_user),
) -> Article:
    """
    Create a new article.

    Args:
        repository_id: Repository identifier
        article_data: Article creation data
        user_email: Authenticated user email

    Returns:
        Created article

    Raises:
        HTTPException: 400 if article already exists or repository is read-only
    """
    logger.info(
        f"Creating article {article_data.path} in repository {repository_id} by {user_email}"
    )

    # Check if repository is read-only
    repo_meta = repository_service.get_repository(repository_id)
    if repo_meta.get("read_only", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Repository '{repository_id}' is read-only",
        )

    repo_path = get_repository_path(repository_id)
    path = validate_path(article_data.path)

    # Ensure path ends with .md
    if not path.endswith(".md"):
        path = f"{path}.md"

    article_path = repo_path / path

    # Check if article already exists
    if article_path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Article '{path}' already exists",
        )

    try:
        # Create parent directories if needed
        article_path.parent.mkdir(parents=True, exist_ok=True)

        # Determine title
        title = article_data.title
        if not title:
            # Derive from filename
            title = article_path.stem.replace("-", " ").replace("_", " ").title()

        # Create frontmatter
        markdown_with_frontmatter = frontmatter_service.create_frontmatter(
            title=title,
            author_email=user_email,
            content=article_data.content,
        )

        # Write file
        article_path.write_text(markdown_with_frontmatter, encoding="utf-8")

        logger.info(f"Article {path} created successfully")

        # Commit and push changes to git
        try:
            git_service = get_git_service(repository_id)
            git_service.add_and_commit([path], "Create", user_email)
            logger.info(f"Committed creation of {path}")

            # Push to remote
            git_service.push_to_remote()
            logger.info(f"Pushed creation of {path} to remote")
        except Exception as git_error:
            logger.warning(f"Failed to commit/push article creation: {git_error}")
            # Continue even if git commit/push fails

        # Parse article for response
        metadata, content = frontmatter_service.parse_article(article_path)

        # Update search index
        update_search_index(
            repository_id=repository_id,
            path=path,
            title=metadata.get("title", title),
            content=content,
            author=normalize_author_field(metadata.get("author")) or user_email,
            created_at=metadata.get("created_at"),
            updated_at=metadata.get("updated_at"),
            updated_by=normalize_author_field(metadata.get("updated_by")) or user_email,
        )

        # Return created article
        return Article(
            path=path,
            title=metadata.get("title", title),
            content=content,
            author=normalize_author_field(metadata.get("author")),
            created_at=metadata.get("created_at"),
            updated_at=metadata.get("updated_at"),
            updated_by=normalize_author_field(metadata.get("updated_by")),
        )

    except Exception as e:
        logger.error(f"Failed to create article {path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create article: {str(e)}",
        )


@router.put("/articles/{path:path}", response_model=Article)
async def update_article(
    repository_id: str,
    path: str,
    article_data: ArticleUpdate,
    user_email: str = Depends(get_current_user),
) -> Article:
    """
    Update an existing article.

    Args:
        repository_id: Repository identifier
        path: Article path relative to repository root
        article_data: Article update data
        user_email: Authenticated user email

    Returns:
        Updated article

    Raises:
        HTTPException: 404 if article not found or 403 if repository is read-only
    """
    logger.info(
        f"Updating article {path} in repository {repository_id} by {user_email}"
    )

    # Check if repository is read-only
    repo_meta = repository_service.get_repository(repository_id)
    if repo_meta.get("read_only", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Repository '{repository_id}' is read-only",
        )

    repo_path = get_repository_path(repository_id)
    path = validate_path(path)

    # Ensure path ends with .md
    if not path.endswith(".md"):
        path = f"{path}.md"

    article_path = repo_path / path

    if not article_path.exists() or not article_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Article '{path}' not found",
        )

    try:
        # Update frontmatter
        markdown_with_frontmatter = frontmatter_service.update_frontmatter(
            file_path=article_path,
            updated_by=user_email,
            content=article_data.content,
        )

        # Write file
        article_path.write_text(markdown_with_frontmatter, encoding="utf-8")

        logger.info(f"Article {path} updated successfully")

        # Commit and push changes to git
        try:
            git_service = get_git_service(repository_id)
            git_service.add_and_commit([path], "Update", user_email)
            logger.info(f"Committed update to {path}")

            # Push to remote
            git_service.push_to_remote()
            logger.info(f"Pushed update to {path} to remote")
        except Exception as git_error:
            logger.warning(f"Failed to commit/push article update: {git_error}")
            # Continue even if git commit/push fails

        # Parse article for response
        metadata, content = frontmatter_service.parse_article(article_path)

        # Update search index
        update_search_index(
            repository_id=repository_id,
            path=path,
            title=metadata.get("title", article_path.stem),
            content=content,
            author=normalize_author_field(metadata.get("author")) or user_email,
            created_at=metadata.get("created_at"),
            updated_at=metadata.get("updated_at"),
            updated_by=normalize_author_field(metadata.get("updated_by")) or user_email,
        )

        # Return updated article
        return Article(
            path=path,
            title=metadata.get("title", article_path.stem),
            content=content,
            author=normalize_author_field(metadata.get("author")),
            created_at=metadata.get("created_at"),
            updated_at=metadata.get("updated_at"),
            updated_by=normalize_author_field(metadata.get("updated_by")),
        )

    except Exception as e:
        logger.error(f"Failed to update article {path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update article: {str(e)}",
        )


@router.delete("/articles/{path:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    repository_id: str,
    path: str,
    background_tasks: BackgroundTasks,
    user_email: str = Depends(get_current_user),
) -> None:
    """
    Delete an article.

    Args:
        repository_id: Repository identifier
        path: Article path relative to repository root
        background_tasks: FastAPI background tasks
        user_email: Authenticated user email

    Raises:
        HTTPException: 404 if article not found or 403 if repository is read-only
    """
    logger.info(
        f"Deleting article {path} from repository {repository_id} by {user_email}"
    )

    # Check if repository is read-only
    repo_meta = repository_service.get_repository(repository_id)
    if repo_meta.get("read_only", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Repository '{repository_id}' is read-only",
        )

    repo_path = get_repository_path(repository_id)
    path = validate_path(path)

    # Ensure path ends with .md
    if not path.endswith(".md"):
        path = f"{path}.md"

    article_path = repo_path / path

    if not article_path.exists() or not article_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Article '{path}' not found",
        )

    try:
        # Delete from filesystem immediately
        article_path.unlink()
        logger.info(f"Article {path} deleted successfully")

        # Offload Git and Search operations to background
        background_tasks.add_task(
            handle_background_deletion,
            repository_id=repository_id,
            git_files=[path],
            search_files=[path],
            commit_message=f"Delete: {path}\n\nAuthor: {user_email}\nDate: {datetime.now(timezone.utc).isoformat()}",
        )

    except Exception as e:
        logger.error(f"Failed to delete article {path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete article: {str(e)}",
        )


@router.post("/articles/{path:path}/move", response_model=Article)
async def move_article(
    repository_id: str,
    path: str,
    move_data: ArticleMove,
    user_email: str = Depends(get_current_user),
) -> Article:
    """
    Move or rename an article.

    Args:
        repository_id: Repository identifier
        path: Current article path
        move_data: New path for the article
        user_email: Authenticated user email

    Returns:
        Moved article with new path

    Raises:
        HTTPException: 404 if article not found, 400 if target exists, or 403 if repository is read-only
    """
    logger.info(
        f"Moving article {path} to {move_data.new_path} in repository {repository_id} by {user_email}"
    )

    # Check if repository is read-only
    repo_meta = repository_service.get_repository(repository_id)
    if repo_meta.get("read_only", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Repository '{repository_id}' is read-only",
        )

    repo_path = get_repository_path(repository_id)
    old_path = validate_path(path)
    new_path = validate_path(move_data.new_path)

    # Ensure paths end with .md
    if not old_path.endswith(".md"):
        old_path = f"{old_path}.md"
    if not new_path.endswith(".md"):
        new_path = f"{new_path}.md"

    old_article_path = repo_path / old_path
    new_article_path = repo_path / new_path

    # Check if source exists
    if not old_article_path.exists() or not old_article_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Article '{old_path}' not found",
        )

    # Check if target already exists
    if new_article_path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Article '{new_path}' already exists",
        )

    try:
        # Create parent directories if needed
        new_article_path.parent.mkdir(parents=True, exist_ok=True)

        # Move file
        old_article_path.rename(new_article_path)

        logger.info(f"Article moved from {old_path} to {new_path} successfully")

        # Commit and push move to git (remove old, add new)
        try:
            git_service = get_git_service(repository_id)
            if git_service.repo:
                git_service.repo.index.remove([old_path])
                git_service.repo.index.add([new_path])
                commit_message = f"Rename: {old_path} → {new_path}\n\nAuthor: {user_email}\nDate: {datetime.now(timezone.utc).isoformat()}"
                git_service.repo.index.commit(commit_message)
                logger.info(f"Committed move from {old_path} to {new_path}")

                # Push to remote
                git_service.push_to_remote()
                logger.info(f"Pushed move from {old_path} to {new_path} to remote")
        except Exception as git_error:
            logger.warning(f"Failed to commit/push article move: {git_error}")
            # Continue even if git commit/push fails

        # Parse article for response
        metadata, content = frontmatter_service.parse_article(new_article_path)

        # Update search index: remove old path and index new path
        remove_from_search_index(repository_id, old_path)
        update_search_index(
            repository_id=repository_id,
            path=new_path,
            title=metadata.get("title", new_article_path.stem),
            content=content,
            author=normalize_author_field(metadata.get("author")) or user_email,
            created_at=metadata.get("created_at"),
            updated_at=metadata.get("updated_at"),
            updated_by=normalize_author_field(metadata.get("updated_by")) or user_email,
        )

        # Return moved article
        return Article(
            path=new_path,
            title=metadata.get("title", new_article_path.stem),
            content=content,
            author=normalize_author_field(metadata.get("author")),
            created_at=metadata.get("created_at"),
            updated_at=metadata.get("updated_at"),
            updated_by=normalize_author_field(metadata.get("updated_by")),
        )

    except Exception as e:
        logger.error(f"Failed to move article from {old_path} to {new_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to move article: {str(e)}",
        )


# ============================================================================
# Directory Endpoints
# ============================================================================


def build_directory_tree(repo_path: Path, current_path: Path) -> List[DirectoryNode]:
    """
    Recursively build directory tree structure.

    Args:
        repo_path: Repository root path
        current_path: Current directory path to scan

    Returns:
        List of directory nodes (files first, then directories, both alphabetically sorted)
    """
    file_nodes = []
    dir_nodes = []

    try:
        # Separate files and directories
        items = list(current_path.iterdir())
        files = sorted([item for item in items if item.is_file()], key=lambda x: x.name)
        directories = sorted(
            [item for item in items if item.is_dir()], key=lambda x: x.name
        )

        # Process files first
        for item in files:
            # Skip hidden files
            if item.name.startswith("."):
                continue

            # Only include markdown files or other text files (binary files included but handled in viewer)
            relative_path = item.relative_to(repo_path)
            node = DirectoryNode(
                type="file",
                name=item.name,
                path=str(relative_path),
                children=None,
            )
            file_nodes.append(node)

        # Process directories
        for item in directories:
            # Skip hidden directories and git directory
            if item.name.startswith("."):
                continue

            relative_path = item.relative_to(repo_path)

            # Recursively build children
            children = build_directory_tree(repo_path, item)

            # Include directory even if it's empty (so users can see and add files to it)
            node = DirectoryNode(
                type="directory",
                name=item.name,
                path=str(relative_path),
                children=children,
            )
            dir_nodes.append(node)

    except Exception as e:
        logger.warning(f"Error reading directory {current_path}: {e}")

    # Return files first, then directories
    return file_nodes + dir_nodes


@router.get("/directories", response_model=DirectoryTreeResponse)
async def get_directories(
    repository_id: str,
    user_email: str = Depends(get_current_user),
) -> DirectoryTreeResponse:
    """
    Get complete directory tree for a repository.

    Returns a hierarchical tree structure of all directories and markdown files.

    Args:
        repository_id: Repository identifier
        user_email: Authenticated user email

    Returns:
        Directory tree
    """
    logger.info(
        f"Getting directory tree for repository {repository_id} by {user_email}"
    )

    repo_path = get_repository_path(repository_id)

    # Build tree
    tree = build_directory_tree(repo_path, repo_path)

    return DirectoryTreeResponse(tree=tree)


@router.post("/directories", status_code=status.HTTP_201_CREATED)
async def create_directory(
    repository_id: str,
    directory_data: DirectoryCreate,
    user_email: str = Depends(get_current_user),
) -> None:
    """
    Create a new directory.

    Args:
        repository_id: Repository identifier
        directory_data: Directory creation data
        user_email: Authenticated user email

    Raises:
        HTTPException: 400 if directory already exists or 403 if repository is read-only
    """
    logger.info(
        f"Creating directory {directory_data.path} in repository {repository_id} by {user_email}"
    )

    # Check if repository is read-only
    repo_meta = repository_service.get_repository(repository_id)
    if repo_meta.get("read_only", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Repository '{repository_id}' is read-only",
        )

    repo_path = get_repository_path(repository_id)
    path = validate_path(directory_data.path)

    dir_path = repo_path / path

    # Check if directory already exists
    if dir_path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Directory '{path}' already exists",
        )

    try:
        dir_path.mkdir(parents=True, exist_ok=False)

        # Create .gitkeep file so Git tracks the empty directory
        gitkeep_path = dir_path / ".gitkeep"
        gitkeep_path.touch()

        logger.info(f"Directory {path} created successfully")

        # Commit and push directory creation to git
        try:
            git_service = get_git_service(repository_id)
            gitkeep_rel_path = f"{path}/.gitkeep"
            git_service.add_and_commit([gitkeep_rel_path], "Create", user_email)
            logger.info(f"Committed creation of directory {path}")

            # Push to remote
            git_service.push_to_remote()
            logger.info(f"Pushed creation of directory {path} to remote")
        except Exception as git_error:
            logger.warning(f"Failed to commit/push directory creation: {git_error}")
            # Continue even if git commit/push fails

    except Exception as e:
        logger.error(f"Failed to create directory {path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create directory: {str(e)}",
        )


@router.delete("/directories/{path:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_directory(
    repository_id: str,
    path: str,
    background_tasks: BackgroundTasks,
    user_email: str = Depends(get_current_user),
) -> None:
    """
    Delete a directory and all its contents.

    Args:
        repository_id: Repository identifier
        path: Directory path relative to repository root
        background_tasks: FastAPI background tasks
        user_email: Authenticated user email

    Raises:
        HTTPException: 404 if directory not found or 403 if repository is read-only
    """
    logger.info(
        f"Deleting directory {path} from repository {repository_id} by {user_email}"
    )

    # Check if repository is read-only
    repo_meta = repository_service.get_repository(repository_id)
    if repo_meta.get("read_only", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Repository '{repository_id}' is read-only",
        )

    repo_path = get_repository_path(repository_id)
    path = validate_path(path)

    dir_path = repo_path / path

    if not dir_path.exists() or not dir_path.is_dir():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Directory '{path}' not found",
        )

    try:
        import shutil

        # Collect all files in the directory for git removal and search index cleanup
        # We must do this BEFORE deleting the files from the filesystem
        git_files = []
        search_files = []

        for file_path in dir_path.rglob("*"):
            if file_path.is_file():
                try:
                    rel_path = str(file_path.relative_to(repo_path))
                    git_files.append(rel_path)

                    # Only markdown files are in the search index
                    if file_path.suffix == ".md":
                        search_files.append(rel_path)
                except ValueError:
                    continue

        # Delete from filesystem immediately
        shutil.rmtree(dir_path)
        logger.info(f"Directory {path} deleted successfully")

        # Offload Git and Search operations to background
        if git_files:
            background_tasks.add_task(
                handle_background_deletion,
                repository_id=repository_id,
                git_files=git_files,
                search_files=search_files,
                commit_message=f"Delete: {path}/ ({len(git_files)} files)\n\nAuthor: {user_email}\nDate: {datetime.now(timezone.utc).isoformat()}",
            )

    except Exception as e:
        logger.error(f"Failed to delete directory {path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete directory: {str(e)}",
        )


@router.post("/directories/{path:path}/move", status_code=status.HTTP_204_NO_CONTENT)
async def move_directory(
    repository_id: str,
    path: str,
    move_data: ArticleMove,  # Reuse ArticleMove schema (has new_path field)
    user_email: str = Depends(get_current_user),
) -> None:
    """
    Move or rename a directory.

    Args:
        repository_id: Repository identifier
        path: Current directory path
        move_data: New path for the directory
        user_email: Authenticated user email

    Raises:
        HTTPException: 404 if directory not found, 400 if target exists, or 403 if repository is read-only
    """
    logger.info(
        f"Moving directory {path} to {move_data.new_path} in repository {repository_id} by {user_email}"
    )

    # Check if repository is read-only
    repo_meta = repository_service.get_repository(repository_id)
    if repo_meta.get("read_only", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Repository '{repository_id}' is read-only",
        )

    repo_path = get_repository_path(repository_id)
    old_path = validate_path(path)
    new_path = validate_path(move_data.new_path)

    old_dir_path = repo_path / old_path
    new_dir_path = repo_path / new_path

    # Check if source exists
    if not old_dir_path.exists() or not old_dir_path.is_dir():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Directory '{old_path}' not found",
        )

    # Check if target already exists
    if new_dir_path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Directory '{new_path}' already exists",
        )

    try:
        # Remove old directory from search index (before moving)
        remove_directory_from_search_index(repository_id, old_dir_path, repo_path)

        # Collect all files in the old directory for git removal
        old_files = []
        for file_path in old_dir_path.rglob("*"):
            if file_path.is_file():
                rel_path = file_path.relative_to(repo_path)
                old_files.append(str(rel_path))

        # Create parent directories if needed
        new_dir_path.parent.mkdir(parents=True, exist_ok=True)

        # Move directory
        old_dir_path.rename(new_dir_path)

        logger.info(f"Directory moved from {old_path} to {new_path} successfully")

        # Collect all files in the new directory for git addition
        new_files = []
        for file_path in new_dir_path.rglob("*"):
            if file_path.is_file():
                rel_path = file_path.relative_to(repo_path)
                new_files.append(str(rel_path))

        # Commit and push directory move to git
        if old_files and new_files:
            try:
                git_service = get_git_service(repository_id)
                if git_service.repo:
                    git_service.repo.index.remove(old_files)
                    git_service.repo.index.add(new_files)
                    commit_message = f"Rename: {old_path}/ → {new_path}/ ({len(new_files)} files)\n\nAuthor: {user_email}\nDate: {datetime.now(timezone.utc).isoformat()}"
                    git_service.repo.index.commit(commit_message)
                    logger.info(f"Committed move from {old_path} to {new_path}")

                    # Push to remote
                    git_service.push_to_remote()
                    logger.info(f"Pushed move from {old_path} to {new_path} to remote")
            except Exception as git_error:
                logger.warning(f"Failed to commit/push directory move: {git_error}")
                # Continue even if git commit/push fails

        # Index new directory location in search
        index_directory_articles(repository_id, new_dir_path, repo_path)

    except Exception as e:
        logger.error(f"Failed to move directory from {old_path} to {new_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to move directory: {str(e)}",
        )


# ============================================================================
# Unified File Serving Endpoint (Catch-all)
# ============================================================================


@router.get("/{path:path}")
async def serve_file(
    repository_id: str,
    path: str,
    user_email: str = Depends(get_current_user),
):
    """
    Unified file serving endpoint for articles and media.

    If the file is a markdown file (.md), parse and return as Article.
    Otherwise, serve as static file (images, PDFs, etc.).

    If the file doesn't exist but has no extension, tries common extensions.

    Args:
        repository_id: Repository identifier
        path: File path relative to repository root
        user_email: Authenticated user email

    Returns:
        Article object for .md files, FileResponse for other files

    Raises:
        HTTPException: 404 if file not found
    """
    logger.info(f"Serving file {path} from repository {repository_id} for {user_email}")

    repo_path = get_repository_path(repository_id)
    path = validate_path(path)

    file_path = repo_path / path

    # If file doesn't exist and has no extension, try common extensions
    if not file_path.exists():
        if not file_path.suffix:
            # Try common image/media extensions
            extensions = [
                ".jpg",
                ".jpeg",
                ".png",
                ".gif",
                ".svg",
                ".webp",
                ".pdf",
                ".mp4",
                ".webm",
            ]
            for ext in extensions:
                test_path = repo_path / f"{path}{ext}"
                if test_path.exists() and test_path.is_file():
                    file_path = test_path
                    path = f"{path}{ext}"
                    break

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{path}' not found",
        )

    # If markdown file, return as Article
    if file_path.suffix == ".md":
        try:
            metadata, content = frontmatter_service.parse_article(file_path)

            return Article(
                path=path,
                title=metadata.get("title", file_path.stem),
                content=content,
                author=normalize_author_field(metadata.get("author")),
                created_at=metadata.get("created_at"),
                updated_at=metadata.get("updated_at"),
                updated_by=normalize_author_field(metadata.get("updated_by")),
            )
        except Exception as e:
            logger.error(f"Failed to read article {path}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read article: {str(e)}",
            )

    # Otherwise, serve as static file
    mime_type, _ = mimetypes.guess_type(str(file_path))

    # Explicitly set Content-Disposition to inline to ensure browser displays file
    headers = {
        "Content-Disposition": f'inline; filename="{file_path.name}"'.replace('"', "'")
    }

    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        headers=headers,
    )

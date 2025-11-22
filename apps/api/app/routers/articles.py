"""
Articles router for WikiGit API.

This module implements the complete article management API including:
- List all articles (GET /articles)
- Get single article (GET /articles/{path:path})
- Create article (POST /articles)
- Update article (PUT /articles/{path:path})
- Delete article (DELETE /articles/{path:path})

Implements SRS requirements REQ-ART-001 through REQ-ART-016.

Ref: SRS Section 6.5 - API Endpoints (Articles)
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.config.settings import settings
from app.middleware.auth import get_current_user
from app.models.schemas import (
    Article,
    ArticleCreate,
    ArticleListResponse,
    ArticleSummary,
    ArticleUpdate,
)
from app.services.frontmatter_service import FrontmatterService
from app.services.git_service import GitService
from app.services.search_service import SearchService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/articles", tags=["articles"])

# Initialize services
frontmatter_service = FrontmatterService()
git_service = GitService(
    repo_path=settings.repository.repo_path, settings=settings.repository
)
search_service = SearchService(
    search_settings=settings.search, repo_path=settings.repository.repo_path
)


@router.get("", response_model=ArticleListResponse)
async def list_articles(
    user_email: str = Depends(get_current_user),
) -> ArticleListResponse:
    """
    List all articles in the wiki repository.

    Implements REQ-ART-001: Provide API endpoint to list all articles.

    This endpoint:
    - Scans the wiki-content directory recursively
    - Finds all .md files
    - Extracts title and updated_at from frontmatter
    - Returns a list of ArticleSummary objects

    Args:
        user_email: Authenticated user email (from dependency)

    Returns:
        ArticleListResponse: List of article summaries

    Raises:
        HTTPException: 500 if directory scanning fails

    Example Response:
        {
            "articles": [
                {
                    "path": "README.md",
                    "title": "Welcome to WikiGit",
                    "updated_at": "2025-11-21T10:00:00Z"
                },
                {
                    "path": "guides/getting-started.md",
                    "title": "Getting Started",
                    "updated_at": "2025-11-21T15:30:00Z"
                }
            ]
        }
    """
    logger.info(f"Listing all articles for user {user_email}")

    try:
        repo_path = settings.repository.repo_path
        articles: List[ArticleSummary] = []

        # Scan repository for .md files recursively
        if not repo_path.exists():
            logger.warning(f"Repository path does not exist: {repo_path}")
            return ArticleListResponse(articles=[])

        for md_file in repo_path.rglob("*.md"):
            try:
                # Calculate relative path from repo root
                relative_path = md_file.relative_to(repo_path)

                # Parse frontmatter to get metadata
                metadata, _ = frontmatter_service.parse_article(md_file)

                # Extract required fields with fallbacks
                title = metadata.get("title", md_file.stem)
                author = metadata.get("author", "unknown@wikigit.app")
                updated_at = metadata.get("updated_at") or metadata.get("created_at")
                updated_by = metadata.get("updated_by", author)

                if not updated_at:
                    logger.warning(
                        f"No timestamp found in frontmatter for {relative_path}, skipping"
                    )
                    continue

                articles.append(
                    ArticleSummary(
                        path=str(relative_path),
                        title=title,
                        author=author,
                        updated_at=updated_at,
                        updated_by=updated_by,
                    )
                )

            except Exception as e:
                logger.error(f"Error processing file {md_file}: {e}")
                # Continue processing other files
                continue

        logger.info(f"Found {len(articles)} articles")
        return ArticleListResponse(articles=articles)

    except Exception as e:
        logger.error(f"Failed to list articles: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list articles: {str(e)}",
        )


@router.get("/{path:path}", response_model=Article)
async def get_article(
    path: str, user_email: str = Depends(get_current_user)
) -> Article:
    """
    Get a single article by path.

    Implements REQ-ART-002: Provide API endpoint to retrieve a single article.
    Implements REQ-ART-015: Parse frontmatter when reading articles.

    This endpoint:
    - Reads the article file from the repository
    - Parses YAML frontmatter for metadata
    - Returns content without frontmatter
    - Returns 404 if file doesn't exist

    Args:
        path: Relative path to article (e.g., "guides/install.md")
        user_email: Authenticated user email (from dependency)

    Returns:
        Article: Complete article with metadata and content

    Raises:
        HTTPException: 404 if article not found
        HTTPException: 500 if reading or parsing fails

    Example Response:
        {
            "path": "guides/getting-started.md",
            "title": "Getting Started",
            "content": "# Getting Started\\n\\nWelcome to WikiGit...",
            "author": "admin@example.com",
            "created_at": "2025-11-21T10:00:00Z",
            "updated_at": "2025-11-21T15:30:00Z",
            "updated_by": "editor@example.com"
        }
    """
    logger.info(f"Getting article at path '{path}' for user {user_email}")

    # Ensure path has .md extension
    if not path.endswith(".md"):
        path = f"{path}.md"

    # Construct full file path
    repo_path = settings.repository.repo_path
    file_path = repo_path / path

    # Security: Ensure file is within repository (prevent path traversal)
    try:
        file_path = file_path.resolve()
        if not str(file_path).startswith(str(repo_path.resolve())):
            logger.warning(f"Path traversal attempt detected: {path}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path"
            )
    except Exception as e:
        logger.error(f"Error resolving path '{path}': {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path"
        )

    # Check if file exists
    if not file_path.exists():
        logger.warning(f"Article not found: {path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Article not found: {path}"
        )

    # Check if path is a file (not a directory)
    if not file_path.is_file():
        logger.warning(f"Path is not a file: {path}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path is not a file: {path}",
        )

    try:
        # Parse article frontmatter and content
        metadata, content = frontmatter_service.parse_article(file_path)

        # Get title from metadata or derive from filename
        title = metadata.get("title")
        if not title:
            # Derive title from filename (remove .md extension and convert hyphens/underscores to spaces)
            title = file_path.stem.replace("-", " ").replace("_", " ").title()
            logger.info(f"No title in metadata, derived from filename: {title}")

        # Extract string values from metadata (handle structured data from legacy wikis)
        def extract_string(value):
            """Extract string from value that might be a dict or string."""
            if value is None:
                return None
            if isinstance(value, dict):
                # Try to extract email or name from structured data
                return value.get("email") or value.get("name") or str(value)
            return str(value) if value else None

        # Extract datetime from various formats
        def extract_datetime(value):
            """Extract datetime string from value."""
            if value is None:
                return None
            if isinstance(value, dict):
                return None  # Can't extract datetime from dict
            return str(value) if value else None

        # Construct Article response with optional metadata
        article = Article(
            path=path,
            title=title,
            content=content,
            author=extract_string(metadata.get("author")),
            created_at=extract_datetime(
                metadata.get("created_at") or metadata.get("createdAt")
            ),
            updated_at=extract_datetime(
                metadata.get("updated_at") or metadata.get("updatedAt")
            ),
            updated_by=extract_string(metadata.get("updated_by")),
        )

        logger.info(f"Successfully retrieved article: {path}")
        return article

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to read article {path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read article: {str(e)}",
        )


@router.post("", response_model=Article, status_code=status.HTTP_201_CREATED)
async def create_article(
    article_data: ArticleCreate, user_email: str = Depends(get_current_user)
) -> Article:
    """
    Create a new article.

    Implements REQ-ART-005: Provide API endpoint to create a new article.
    Implements REQ-ART-011: Add YAML frontmatter to all markdown files.
    Implements REQ-ART-012: Include metadata in frontmatter (title, author, timestamps).

    This endpoint:
    - Validates that the path ends with .md extension (REQ-ART-010)
    - Checks that the file doesn't already exist
    - Creates YAML frontmatter with current user as author
    - Writes the file to the repository
    - Creates a Git commit with "Create" action
    - Pushes to remote if configured
    - Returns the created article

    Args:
        article_data: Article creation request with path, content, and optional title
        user_email: Authenticated user email (from dependency)

    Returns:
        Article: The created article with all metadata

    Raises:
        HTTPException: 400 if file already exists or path is invalid
        HTTPException: 500 if creation fails

    Example Request:
        {
            "path": "guides/new-tutorial.md",
            "content": "# New Tutorial\\n\\nThis is a tutorial...",
            "title": "New Tutorial"
        }

    Example Response:
        {
            "path": "guides/new-tutorial.md",
            "title": "New Tutorial",
            "content": "# New Tutorial\\n\\nThis is a tutorial...",
            "author": "user@example.com",
            "created_at": "2025-11-21T16:00:00Z",
            "updated_at": "2025-11-21T16:00:00Z",
            "updated_by": "user@example.com"
        }
    """
    logger.info(f"Creating article at path '{article_data.path}' by user {user_email}")

    # Construct full file path
    repo_path = settings.repository.repo_path
    file_path = repo_path / article_data.path

    # Security: Ensure file will be within repository (prevent path traversal)
    try:
        # Ensure parent directory exists for resolve()
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path_resolved = file_path.resolve()

        if not str(file_path_resolved).startswith(str(repo_path.resolve())):
            logger.warning(f"Path traversal attempt detected: {article_data.path}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path"
            )
    except Exception as e:
        logger.error(f"Error resolving path '{article_data.path}': {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path"
        )

    # Check if file already exists
    if file_path.exists():
        logger.warning(f"Article already exists: {article_data.path}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Article already exists: {article_data.path}",
        )

    # Determine title: use provided title or derive from filename
    title = article_data.title
    if not title:
        # Try to extract from content
        title = frontmatter_service.extract_title_from_content(article_data.content)
        if not title:
            # Fallback to filename without extension
            title = file_path.stem.replace("-", " ").replace("_", " ").title()
        logger.debug(f"Derived title from filename: {title}")

    try:
        # Create frontmatter with current user as author
        markdown_with_frontmatter = frontmatter_service.create_frontmatter(
            title=title, author_email=user_email, content=article_data.content
        )

        # Ensure parent directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Write file to disk
        file_path.write_text(markdown_with_frontmatter, encoding="utf-8")
        logger.info(f"Article file created: {file_path}")

        # Git commit
        commit_sha = git_service.add_and_commit(
            file_paths=[str(article_data.path)], action="Create", user_email=user_email
        )
        logger.info(f"Git commit created: {commit_sha[:7]}")

        # Push to remote if configured
        if settings.repository.auto_push:
            push_success = git_service.push_to_remote()
            if push_success:
                logger.info("Pushed to remote repository")
            else:
                logger.warning("Failed to push to remote repository")

        # Parse the created article to return full metadata
        metadata, content = frontmatter_service.parse_article(file_path)

        article = Article(
            path=article_data.path,
            title=metadata.get("title", title),
            content=content,
            author=metadata.get("author", user_email),
            created_at=metadata.get("created_at"),
            updated_at=metadata.get("updated_at"),
            updated_by=metadata.get("updated_by", user_email),
        )

        # Update search index
        try:
            search_service.index_article(
                path=article.path,
                title=article.title,
                content=article.content,
                author=article.author or "unknown",
                created_at=article.created_at,
                updated_at=article.updated_at,
                updated_by=article.updated_by or "unknown",
            )
            logger.info(f"Article indexed in search: {article_data.path}")
        except Exception as search_error:
            logger.error(f"Failed to index article in search: {search_error}")

        logger.info(f"Successfully created article: {article_data.path}")
        return article

    except Exception as e:
        # Cleanup: remove file if it was created
        if file_path.exists():
            try:
                file_path.unlink()
                logger.info(f"Cleaned up failed article creation: {file_path}")
            except Exception as cleanup_error:
                logger.error(f"Failed to cleanup file after error: {cleanup_error}")

        logger.error(f"Failed to create article {article_data.path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create article: {str(e)}",
        )


@router.put("/{path:path}", response_model=Article)
async def update_article(
    path: str, article_data: ArticleUpdate, user_email: str = Depends(get_current_user)
) -> Article:
    """
    Update an existing article.

    Implements REQ-ART-013: Automatically update updated_at and updated_by.
    Implements REQ-ART-014: Preserve existing frontmatter (title, author, created_at).

    This endpoint:
    - Updates the article content
    - Preserves immutable frontmatter fields (title, author, created_at)
    - Updates mutable fields (updated_at, updated_by) automatically
    - Creates a Git commit with "Update" action
    - Pushes to remote if configured
    - Returns the updated article

    Args:
        path: Relative path to article (e.g., "guides/install.md")
        article_data: Article update request with new content
        user_email: Authenticated user email (from dependency)

    Returns:
        Article: The updated article with refreshed metadata

    Raises:
        HTTPException: 404 if article not found
        HTTPException: 500 if update fails

    Example Request:
        {
            "content": "# Updated Getting Started\\n\\nThis guide has been updated..."
        }

    Example Response:
        {
            "path": "guides/getting-started.md",
            "title": "Getting Started",
            "content": "# Updated Getting Started\\n\\nThis guide has been updated...",
            "author": "admin@example.com",
            "created_at": "2025-11-21T10:00:00Z",
            "updated_at": "2025-11-21T16:30:00Z",
            "updated_by": "editor@example.com"
        }
    """
    logger.info(f"Updating article at path '{path}' by user {user_email}")

    # Ensure path has .md extension
    if not path.endswith(".md"):
        path = f"{path}.md"

    # Construct full file path
    repo_path = settings.repository.repo_path
    file_path = repo_path / path

    # Security: Ensure file is within repository (prevent path traversal)
    try:
        file_path = file_path.resolve()
        if not str(file_path).startswith(str(repo_path.resolve())):
            logger.warning(f"Path traversal attempt detected: {path}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path"
            )
    except Exception as e:
        logger.error(f"Error resolving path '{path}': {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path"
        )

    # Check if file exists
    if not file_path.exists():
        logger.warning(f"Article not found: {path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Article not found: {path}"
        )

    # Check if path is a file (not a directory)
    if not file_path.is_file():
        logger.warning(f"Path is not a file: {path}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path is not a file: {path}",
        )

    try:
        # Update frontmatter (preserves title, author, created_at; updates updated_at, updated_by)
        markdown_with_frontmatter = frontmatter_service.update_frontmatter(
            file_path=file_path, updated_by=user_email, content=article_data.content
        )

        # Write updated content to disk
        file_path.write_text(markdown_with_frontmatter, encoding="utf-8")
        logger.info(f"Article file updated: {file_path}")

        # Git commit
        commit_sha = git_service.add_and_commit(
            file_paths=[str(path)], action="Update", user_email=user_email
        )
        logger.info(f"Git commit created: {commit_sha[:7]}")

        # Push to remote if configured
        if settings.repository.auto_push:
            push_success = git_service.push_to_remote()
            if push_success:
                logger.info("Pushed to remote repository")
            else:
                logger.warning("Failed to push to remote repository")

        # Parse the updated article to return full metadata
        metadata, content = frontmatter_service.parse_article(file_path)

        # Extract string values from metadata (handle structured data from legacy wikis)
        def extract_string(value):
            """Extract string from value that might be a dict or string."""
            if value is None:
                return None
            if isinstance(value, dict):
                # Try to extract email or name from structured data
                return value.get("email") or value.get("name") or str(value)
            return str(value) if value else None

        article = Article(
            path=path,
            title=metadata.get("title", path.replace(".md", "").replace("-", " ").title()),
            content=content,
            author=extract_string(metadata.get("author")),
            created_at=metadata.get("created_at") if isinstance(metadata.get("created_at"), str) else None,
            updated_at=metadata.get("updated_at") if isinstance(metadata.get("updated_at"), str) else None,
            updated_by=extract_string(metadata.get("updated_by")),
        )

        # Update search index
        try:
            search_service.index_article(
                path=article.path,
                title=article.title,
                content=article.content,
                author=article.author or "unknown",
                created_at=article.created_at,
                updated_at=article.updated_at,
                updated_by=article.updated_by or "unknown",
            )
            logger.info(f"Article re-indexed in search: {path}")
        except Exception as search_error:
            logger.error(f"Failed to re-index article in search: {search_error}")

        logger.info(f"Successfully updated article: {path}")
        return article

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update article {path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update article: {str(e)}",
        )


@router.delete("/{path:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    path: str, user_email: str = Depends(get_current_user)
) -> None:
    """
    Delete an article.

    Implements REQ-ART-007: Provide API endpoint to delete an article.

    This endpoint:
    - Deletes the article file from the filesystem
    - Creates a Git commit with "Delete" action
    - Pushes to remote if configured
    - Returns 204 No Content on success

    Args:
        path: Relative path to article (e.g., "guides/install.md")
        user_email: Authenticated user email (from dependency)

    Returns:
        None (204 No Content)

    Raises:
        HTTPException: 404 if article not found
        HTTPException: 500 if deletion fails

    Example:
        DELETE /articles/guides/old-tutorial.md
        Response: 204 No Content
    """
    logger.info(f"Deleting article at path '{path}' by user {user_email}")

    # Ensure path has .md extension
    if not path.endswith(".md"):
        path = f"{path}.md"

    # Construct full file path
    repo_path = settings.repository.repo_path
    file_path = repo_path / path

    # Security: Ensure file is within repository (prevent path traversal)
    try:
        file_path = file_path.resolve()
        if not str(file_path).startswith(str(repo_path.resolve())):
            logger.warning(f"Path traversal attempt detected: {path}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path"
            )
    except Exception as e:
        logger.error(f"Error resolving path '{path}': {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path"
        )

    # Check if file exists
    if not file_path.exists():
        logger.warning(f"Article not found: {path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Article not found: {path}"
        )

    # Check if path is a file (not a directory)
    if not file_path.is_file():
        logger.warning(f"Path is not a file: {path}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path is not a file: {path}",
        )

    try:
        # Delete file from filesystem
        file_path.unlink()
        logger.info(f"Article file deleted: {file_path}")

        # Git commit (add the deletion)
        # For deleted files, we need to use git add with the file path
        # This stages the deletion
        commit_sha = git_service.add_and_commit(
            file_paths=[str(path)], action="Delete", user_email=user_email
        )
        logger.info(f"Git commit created: {commit_sha[:7]}")

        # Push to remote if configured
        if settings.repository.auto_push:
            push_success = git_service.push_to_remote()
            if push_success:
                logger.info("Pushed to remote repository")
            else:
                logger.warning("Failed to push to remote repository")

        # Remove from search index
        try:
            search_service.remove_article(path)
            logger.info(f"Article removed from search index: {path}")
        except Exception as search_error:
            logger.error(f"Failed to remove article from search index: {search_error}")
            # Don't fail the request if search index removal fails

        logger.info(f"Successfully deleted article: {path}")

    except Exception as e:
        logger.error(f"Failed to delete article {path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete article: {str(e)}",
        )

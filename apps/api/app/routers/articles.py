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
from pathlib import Path
from typing import List
from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException, status

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
from app.services.frontmatter_service import FrontmatterService
from app.services.repository_service import RepositoryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repositories/{repository_id}", tags=["articles"])

# Initialize services
REPOSITORIES_CONFIG_PATH = (
    settings.multi_repository.root_dir / "config" / "repositories.json"
)
repository_service = RepositoryService(REPOSITORIES_CONFIG_PATH)
frontmatter_service = FrontmatterService()


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
                author=metadata.get("author"),
                updated_at=metadata.get("updated_at"),
                updated_by=metadata.get("updated_by"),
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
        # Parse article
        metadata, content = frontmatter_service.parse_article(article_path)

        return Article(
            path=path,
            title=metadata.get("title", article_path.stem),
            content=content,
            author=metadata.get("author"),
            created_at=metadata.get("created_at"),
            updated_at=metadata.get("updated_at"),
            updated_by=metadata.get("updated_by"),
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

        # Return created article
        metadata, content = frontmatter_service.parse_article(article_path)
        return Article(
            path=path,
            title=metadata.get("title", title),
            content=content,
            author=metadata.get("author"),
            created_at=metadata.get("created_at"),
            updated_at=metadata.get("updated_at"),
            updated_by=metadata.get("updated_by"),
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

        # Return updated article
        metadata, content = frontmatter_service.parse_article(article_path)
        return Article(
            path=path,
            title=metadata.get("title", article_path.stem),
            content=content,
            author=metadata.get("author"),
            created_at=metadata.get("created_at"),
            updated_at=metadata.get("updated_at"),
            updated_by=metadata.get("updated_by"),
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
    user_email: str = Depends(get_current_user),
) -> None:
    """
    Delete an article.

    Args:
        repository_id: Repository identifier
        path: Article path relative to repository root
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
        article_path.unlink()
        logger.info(f"Article {path} deleted successfully")

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

        # Return moved article
        metadata, content = frontmatter_service.parse_article(new_article_path)
        return Article(
            path=new_path,
            title=metadata.get("title", new_article_path.stem),
            content=content,
            author=metadata.get("author"),
            created_at=metadata.get("created_at"),
            updated_at=metadata.get("updated_at"),
            updated_by=metadata.get("updated_by"),
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
        List of directory nodes
    """
    nodes = []

    try:
        for item in sorted(current_path.iterdir()):
            # Skip hidden files and git directory
            if item.name.startswith("."):
                continue

            relative_path = item.relative_to(repo_path)

            if item.is_dir():
                # Recursively build children
                children = build_directory_tree(repo_path, item)
                node = DirectoryNode(
                    type="directory",
                    name=item.name,
                    path=str(relative_path),
                    children=children,
                )
            else:
                # Only include markdown files
                if item.suffix == ".md":
                    node = DirectoryNode(
                        type="file",
                        name=item.name,
                        path=str(relative_path),
                        children=None,
                    )
                else:
                    continue  # Skip non-markdown files

            nodes.append(node)

    except Exception as e:
        logger.warning(f"Error reading directory {current_path}: {e}")

    return nodes


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
        logger.info(f"Directory {path} created successfully")

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
    user_email: str = Depends(get_current_user),
) -> None:
    """
    Delete a directory and all its contents.

    Args:
        repository_id: Repository identifier
        path: Directory path relative to repository root
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

        shutil.rmtree(dir_path)
        logger.info(f"Directory {path} deleted successfully")

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
        # Create parent directories if needed
        new_dir_path.parent.mkdir(parents=True, exist_ok=True)

        # Move directory
        old_dir_path.rename(new_dir_path)

        logger.info(f"Directory moved from {old_path} to {new_path} successfully")

    except Exception as e:
        logger.error(f"Failed to move directory from {old_path} to {new_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to move directory: {str(e)}",
        )

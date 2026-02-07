"""Directory management router for multi-repository support."""

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.middleware.auth import get_current_user
from app.models.schemas import (
    ArticleMove,
    DirectoryCreate,
    DirectoryNode,
    DirectoryTreeResponse,
)
from app.routers.article_helpers import (
    get_git_service,
    get_repository_path,
    handle_background_deletion,
    index_directory_articles,
    remove_directory_from_search_index,
    validate_path,
)
from app.services import repository_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repositories/{repository_id}", tags=["directories"])


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

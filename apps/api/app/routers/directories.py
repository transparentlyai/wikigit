"""
Directory management endpoints for WikiGit API.

This module provides endpoints for managing directories in the git repository.
Directories are used to organize articles into hierarchical sections.
"""

import logging
import shutil
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from app.config.settings import settings
from app.middleware.auth import get_current_user, require_admin
from app.models.schemas import Directory, DirectoryCreate, DirectoryMove, DirectoryNode
from app.services.git_service import GitService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/directories", tags=["directories"])


def get_git_service():
    """Dependency to get GitService instance."""
    return GitService(settings.repository.repo_path, settings.repository)


def build_directory_tree(base_path: Path) -> List[DirectoryNode]:
    """
    Build a hierarchical tree of directories and articles.

    Args:
        base_path: Base repository path to scan

    Returns:
        List of DirectoryNode objects representing the tree structure
    """

    def scan_directory(dir_path: Path, relative_path: str = "") -> DirectoryNode:
        """Recursively scan a directory and build its node."""
        children: List[DirectoryNode] = []

        if not dir_path.exists() or not dir_path.is_dir():
            return DirectoryNode(
                name=dir_path.name, path=relative_path, type="directory", children=[]
            )

        # Iterate through directory contents
        # Separate files and directories for custom sorting
        items = list(dir_path.iterdir())
        files = []
        directories = []

        for item in items:
            # Skip hidden files, git directory, and media directory
            if item.name.startswith(".") or item.name in [".git", "media"]:
                continue

            if item.is_dir():
                directories.append(item)
            elif item.suffix == ".md":
                files.append(item)

        # Sort files first, then directories (both alphabetically)
        sorted_items = sorted(files, key=lambda x: x.name.lower()) + sorted(
            directories, key=lambda x: x.name.lower()
        )

        for item in sorted_items:
            item_relative = f"{relative_path}/{item.name}".lstrip("/")

            if item.is_dir():
                # Recursively scan subdirectories
                child_node = scan_directory(item, item_relative)
                children.append(child_node)
            elif item.suffix == ".md":
                # Add markdown files as files
                article_path = item_relative[:-3]  # Remove .md extension
                children.append(
                    DirectoryNode(
                        name=item.stem, path=article_path, type="file", children=None
                    )
                )

        return DirectoryNode(
            name=dir_path.name if relative_path else "root",
            path=relative_path,
            type="directory",
            children=children,
        )

    # Start scanning from base path
    root_node = scan_directory(base_path)

    # Return root's children (we don't want to expose the root node itself)
    return root_node.children or []


@router.get("", response_model=List[DirectoryNode])
async def list_directories(_user: str = Depends(get_current_user)):
    """
    Get hierarchical directory tree with articles.

    Returns a tree structure of all directories and articles in the repository.
    This is used for navigation and displaying the wiki structure.

    Returns:
        List[DirectoryNode]: Hierarchical tree of directories and articles

    Raises:
        HTTPException: If there's an error reading the repository
    """
    try:
        repo_path = Path(settings.repository.repo_path)
        tree = build_directory_tree(repo_path)
        return tree
    except Exception as e:
        logger.error(f"Failed to list directories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list directories: {str(e)}",
        )


@router.post("", response_model=Directory, status_code=status.HTTP_201_CREATED)
async def create_directory(
    directory: DirectoryCreate,
    user: str = Depends(get_current_user),
    git_service: GitService = Depends(get_git_service),
):
    """
    Create a new directory in the repository.

    Creates a directory at the specified path. If parent directories don't exist,
    they will be created automatically. A .gitkeep file is added to ensure the
    directory is tracked by git.

    Args:
        directory: Directory creation data containing path
        user: Current authenticated user email
        git_service: Git service instance

    Returns:
        Directory: Created directory information

    Raises:
        HTTPException: If directory already exists or creation fails
    """
    try:
        # Validate directory path
        if not directory.path or directory.path.strip() == "":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Directory path cannot be empty",
            )

        # Remove leading/trailing slashes
        clean_path = directory.path.strip("/")

        # Validate path doesn't contain invalid characters
        invalid_chars = ["..", "\\", "<", ">", ":", '"', "|", "?", "*"]
        if any(char in clean_path for char in invalid_chars):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Directory path contains invalid characters",
            )

        # Build full directory path
        repo_path = Path(settings.repository.repo_path)
        dir_path = repo_path / clean_path

        # Check if directory already exists
        if dir_path.exists():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Directory already exists: {clean_path}",
            )

        # Create directory and all parent directories
        dir_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Created directory: {dir_path}")

        # Create .gitkeep file to ensure directory is tracked
        gitkeep_path = dir_path / ".gitkeep"
        gitkeep_path.write_text("# This file ensures the directory is tracked by git\n")
        logger.info(f"Created .gitkeep file: {gitkeep_path}")

        # Commit to git
        git_service.add_and_commit(
            file_paths=[str(gitkeep_path.relative_to(repo_path))],
            action="Create",
            user_email=user,
        )
        logger.info(f"Committed directory creation: {clean_path}")

        # Push to remote if configured
        if settings.repository.auto_push and settings.repository.remote_url:
            git_service.push_to_remote()
            logger.info(f"Pushed directory creation to remote: {clean_path}")

        return Directory(path=clean_path, name=dir_path.name)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create directory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create directory: {str(e)}",
        )


@router.delete("/{path:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_directory(
    path: str,
    user: str = Depends(require_admin),
    git_service: GitService = Depends(get_git_service),
):
    """
    Delete a directory and all its contents.

    Removes the directory and all files/subdirectories within it. This operation
    is destructive and requires admin privileges.

    Args:
        path: Directory path to delete
        user: Current authenticated admin user email
        git_service: Git service instance

    Raises:
        HTTPException: If directory doesn't exist, is not empty (has articles),
                      or deletion fails
    """
    try:
        # Validate path
        if not path or path.strip() == "":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Directory path cannot be empty",
            )

        # Clean path
        clean_path = path.strip("/")

        # Build full directory path
        repo_path = Path(settings.repository.repo_path)
        dir_path = repo_path / clean_path

        # Check if directory exists
        if not dir_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Directory not found: {clean_path}",
            )

        if not dir_path.is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Path is not a directory: {clean_path}",
            )

        # Check if directory contains any markdown files (articles)
        has_articles = any(
            item.suffix == ".md" for item in dir_path.rglob("*") if item.is_file()
        )

        if has_articles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Directory contains articles and cannot be deleted: {clean_path}. "
                    "Please delete all articles in the directory first."
                ),
            )

        # Get all files to remove for git
        files_to_remove = []
        for item in dir_path.rglob("*"):
            if item.is_file() and not any(
                part.startswith(".git") for part in item.parts
            ):
                rel_path = item.relative_to(repo_path)
                files_to_remove.append(str(rel_path))

        # Remove directory from filesystem
        shutil.rmtree(dir_path)
        logger.info(f"Removed directory: {dir_path}")

        # Commit to git if there were files
        if files_to_remove:
            commit_message = f"delete: directory {clean_path}"
            # Stage all removed files
            repo = git_service.repo
            repo.index.remove(files_to_remove, working_tree=True, r=True)
            repo.index.commit(
                f"{commit_message}\n\nAuthor: {user}\nDate: {git_service._get_iso_timestamp()}"
            )
            logger.info(f"Committed directory deletion: {clean_path}")

            # Push to remote if configured
            if settings.repository.auto_push and settings.repository.remote_url:
                git_service.push_to_remote()
                logger.info(f"Pushed directory deletion to remote: {clean_path}")

        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete directory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete directory: {str(e)}",
        )


@router.post("/{path:path}/move", response_model=Directory)
async def move_directory(
    path: str,
    move_data: DirectoryMove,
    user: str = Depends(get_current_user),
    git_service: GitService = Depends(get_git_service),
):
    """
    Move or rename a directory.

    Moves a directory and all its contents to a new location.

    Args:
        path: Current directory path
        move_data: Move request with new path
        user: Current authenticated user email
        git_service: Git service instance

    Returns:
        Directory: Information about the moved directory

    Raises:
        HTTPException: If directory doesn't exist, destination exists, or move fails
    """
    try:
        new_path = move_data.new_path
        logger.info(f"Moving directory from '{path}' to '{new_path}' by user {user}")

        # Clean paths
        clean_src_path = path.strip("/")
        clean_dest_path = new_path.strip("/")

        # Build full directory paths
        repo_path = Path(settings.repository.repo_path)
        src_dir_path = repo_path / clean_src_path
        dest_dir_path = repo_path / clean_dest_path

        # Security: Ensure paths are within repository
        try:
            src_dir_path = src_dir_path.resolve()
            dest_dir_path = dest_dir_path.resolve()
            if not str(src_dir_path).startswith(str(repo_path.resolve())):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid source path",
                )
            if not str(dest_dir_path).startswith(str(repo_path.resolve())):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid destination path",
                )
        except Exception as e:
            logger.error(f"Error resolving paths: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid directory path"
            )

        # Check if source exists
        if not src_dir_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Directory not found: {clean_src_path}",
            )

        if not src_dir_path.is_dir():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Path is not a directory: {clean_src_path}",
            )

        # Check if destination already exists
        if dest_dir_path.exists():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Destination already exists: {clean_dest_path}",
            )

        # Create parent directories if needed
        dest_dir_path.parent.mkdir(parents=True, exist_ok=True)

        # Get all files in the source directory for git
        files_to_move = []
        for item in src_dir_path.rglob("*"):
            if item.is_file() and not any(
                part.startswith(".git") for part in item.parts
            ):
                rel_src_path = item.relative_to(repo_path)
                # Calculate destination path
                rel_to_src_dir = item.relative_to(src_dir_path)
                rel_dest_path = Path(clean_dest_path) / rel_to_src_dir
                files_to_move.append((str(rel_src_path), str(rel_dest_path)))

        # Move directory
        src_dir_path.rename(dest_dir_path)
        logger.info(f"Moved directory from {src_dir_path} to {dest_dir_path}")

        # Git commit (stage all old and new paths)
        all_paths = []
        for src, dest in files_to_move:
            all_paths.append(src)
            all_paths.append(dest)

        if all_paths:
            git_service.add_and_commit(
                file_paths=all_paths,
                action="Rename",
                user_email=user,
            )
            logger.info("Git commit created for directory move")

            # Push to remote if configured
            if settings.repository.auto_push and settings.repository.remote_url:
                git_service.push_to_remote()
                logger.info("Pushed directory move to remote")

        return Directory(path=clean_dest_path, name=dest_dir_path.name)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to move directory: {e}")
        # Try to rollback if possible
        if dest_dir_path.exists() and not src_dir_path.exists():
            dest_dir_path.rename(src_dir_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to move directory: {str(e)}",
        )

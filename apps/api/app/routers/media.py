"""
Media router for WikiGit API.

This module implements media file management including:
- Upload media files (POST /media)
- List media files (GET /media)
- Delete media files (DELETE /media/{filename})
- Serve media files (GET /media/serve/{path:path})

Supported file types: jpg, jpeg, png, gif, svg, pdf, mp4, webm, mp3, wav, txt
"""

import logging
import mimetypes
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.config.settings import settings
from app.middleware.auth import get_current_user
from app.models.schemas import MediaFile, MediaListResponse
from app.services.git_service import GitService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/media", tags=["media"])

# Allowed media file extensions
ALLOWED_EXTENSIONS = {
    # Images
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
    ".bmp",
    ".ico",
    # Documents
    ".pdf",
    ".txt",
    ".md",
    # Video
    ".mp4",
    ".webm",
    ".mov",
    ".avi",
    # Audio
    ".mp3",
    ".wav",
    ".ogg",
    ".m4a",
}

# Max file size: 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024

# Initialize services
git_service = GitService(
    repo_path=settings.repository.repo_path, settings=settings.repository
)


def get_media_path() -> Path:
    """Get the media directory path."""
    media_path = settings.repository.repo_path / "media"
    media_path.mkdir(parents=True, exist_ok=True)
    return media_path


def is_allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    return any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS)


@router.post("", response_model=MediaFile, status_code=status.HTTP_201_CREATED)
async def upload_media(
    file: UploadFile = File(...),
    user_email: str = Depends(get_current_user),
) -> MediaFile:
    """
    Upload a media file to the media directory.

    This endpoint:
    - Validates file type against allowed extensions
    - Validates file size (max 10MB)
    - Saves file to media/ directory
    - Creates a Git commit
    - Returns file metadata

    Args:
        file: The uploaded file
        user_email: Authenticated user email (from dependency)

    Returns:
        MediaFile: Metadata about the uploaded file

    Raises:
        HTTPException: 400 if file type not allowed or file too large
        HTTPException: 500 if upload fails
    """
    logger.info(f"Uploading media file '{file.filename}' by user {user_email}")

    # Validate filename
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required",
        )

    # Validate file extension
    if not is_allowed_file(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Security: Sanitize filename (remove path traversal attempts)
    safe_filename = Path(file.filename).name

    try:
        # Read file content
        content = await file.read()

        # Validate file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB",
            )

        # Get media directory
        media_path = get_media_path()
        file_path = media_path / safe_filename

        # Check if file already exists
        if file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File already exists: {safe_filename}",
            )

        # Write file to disk
        file_path.write_bytes(content)
        logger.info(f"Media file written: {file_path}")

        # Git commit
        relative_path = f"media/{safe_filename}"
        commit_sha = git_service.add_and_commit(
            file_paths=[relative_path],
            action="Upload media",
            user_email=user_email,
        )
        logger.info(f"Git commit created: {commit_sha[:7]}")

        # Push to remote if configured
        if settings.repository.auto_push:
            push_success = git_service.push_to_remote()
            if push_success:
                logger.info("Pushed to remote repository")
            else:
                logger.warning("Failed to push to remote repository")

        # Determine content type
        content_type, _ = mimetypes.guess_type(safe_filename)

        media_file = MediaFile(
            filename=safe_filename,
            path=relative_path,
            size=len(content),
            content_type=content_type or "application/octet-stream",
            url=f"/media/{safe_filename}",
        )

        logger.info(f"Successfully uploaded media file: {safe_filename}")
        return media_file

    except HTTPException:
        raise
    except Exception as e:
        # Cleanup: remove file if it was created
        if file_path.exists():
            try:
                file_path.unlink()
                logger.info(f"Cleaned up failed upload: {file_path}")
            except Exception as cleanup_error:
                logger.error(f"Failed to cleanup file after error: {cleanup_error}")

        logger.error(f"Failed to upload media file {file.filename}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}",
        )


@router.get("", response_model=MediaListResponse)
async def list_media(
    user_email: str = Depends(get_current_user),
) -> MediaListResponse:
    """
    List all media files in the media directory.

    Returns:
        MediaListResponse: List of media files with metadata
    """
    logger.info(f"Listing media files for user {user_email}")

    try:
        media_path = get_media_path()
        media_files: List[MediaFile] = []

        # Scan media directory for files
        for file_path in media_path.iterdir():
            if file_path.is_file() and file_path.name != "README.md":
                # Get file size
                file_size = file_path.stat().st_size

                # Determine content type
                content_type, _ = mimetypes.guess_type(file_path.name)

                # Create relative path
                relative_path = f"media/{file_path.name}"

                media_files.append(
                    MediaFile(
                        filename=file_path.name,
                        path=relative_path,
                        size=file_size,
                        content_type=content_type or "application/octet-stream",
                        url=f"/media/{file_path.name}",
                    )
                )

        logger.info(f"Found {len(media_files)} media files")
        return MediaListResponse(files=media_files)

    except Exception as e:
        logger.error(f"Failed to list media files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list media files: {str(e)}",
        )


@router.delete("/{filename}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(
    filename: str,
    user_email: str = Depends(get_current_user),
) -> None:
    """
    Delete a media file.

    Args:
        filename: Name of the file to delete
        user_email: Authenticated user email (from dependency)

    Raises:
        HTTPException: 404 if file not found
        HTTPException: 500 if deletion fails
    """
    logger.info(f"Deleting media file '{filename}' by user {user_email}")

    # Security: Sanitize filename
    safe_filename = Path(filename).name

    media_path = get_media_path()
    file_path = media_path / safe_filename

    # Check if file exists
    if not file_path.exists():
        logger.warning(f"Media file not found: {filename}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Media file not found: {filename}",
        )

    # Check if path is a file (not a directory)
    if not file_path.is_file():
        logger.warning(f"Path is not a file: {filename}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path is not a file: {filename}",
        )

    try:
        # Delete file from filesystem
        file_path.unlink()
        logger.info(f"Media file deleted: {file_path}")

        # Git commit (stage the deletion)
        relative_path = f"media/{safe_filename}"
        commit_sha = git_service.add_and_commit(
            file_paths=[relative_path],
            action="Delete media",
            user_email=user_email,
        )
        logger.info(f"Git commit created: {commit_sha[:7]}")

        # Push to remote if configured
        if settings.repository.auto_push:
            push_success = git_service.push_to_remote()
            if push_success:
                logger.info("Pushed to remote repository")
            else:
                logger.warning("Failed to push to remote repository")

        logger.info(f"Successfully deleted media file: {filename}")

    except Exception as e:
        logger.error(f"Failed to delete media file {filename}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete file: {str(e)}",
        )


@router.get("/{path:path}")
async def serve_media(
    path: str,
    user_email: str = Depends(get_current_user),
) -> FileResponse:
    """
    Serve a media file from any directory in the repository.

    This endpoint allows serving media files from anywhere in the repository,
    not just the media/ directory. This enables embedding images and files
    that are stored alongside articles.

    Args:
        path: Relative path to the file (e.g., "image.png" or "subdir/diagram.svg")
        user_email: Authenticated user email (from dependency)

    Returns:
        FileResponse: The requested file

    Raises:
        HTTPException: 404 if file not found
        HTTPException: 400 if path is invalid
    """
    logger.info(f"Serving media file '{path}' for user {user_email}")

    # Prepend 'media/' to the path since files are stored in media directory
    path = f"media/{path}"

    # Construct full file path
    repo_path = settings.repository.repo_path
    file_path = repo_path / path

    # Security: Ensure file is within repository (prevent path traversal)
    try:
        file_path = file_path.resolve()
        if not str(file_path).startswith(str(repo_path.resolve())):
            logger.warning(f"Path traversal attempt detected: {path}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path",
            )
    except Exception as e:
        logger.error(f"Error resolving path '{path}': {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path",
        )

    # Check if file exists
    if not file_path.exists():
        logger.warning(f"Media file not found: {path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {path}",
        )

    # Check if path is a file (not a directory)
    if not file_path.is_file():
        logger.warning(f"Path is not a file: {path}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path is not a file: {path}",
        )

    # Validate file extension
    if not is_allowed_file(file_path.name):
        logger.warning(f"File type not allowed: {path}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File type not allowed",
        )

    # Determine content type
    content_type, _ = mimetypes.guess_type(file_path.name)

    logger.info(f"Serving media file: {path}")
    return FileResponse(
        path=file_path,
        media_type=content_type or "application/octet-stream",
        filename=file_path.name,
    )

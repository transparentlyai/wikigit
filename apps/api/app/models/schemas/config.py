"""Configuration, health, media, error, and user Pydantic models."""

from datetime import UTC, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# ============================================================================
# Configuration Models
# ============================================================================


class AppConfig(BaseModel):
    """Application configuration section."""

    name: Optional[str] = Field(None, description="Application name")
    description: Optional[str] = Field(None, description="Application description")
    domain: Optional[str] = Field(None, description="Application domain")
    max_file_size_mb: Optional[int] = Field(
        None, ge=1, le=100, description="Maximum file size in MB"
    )
    admins: Optional[list[str]] = Field(None, description="List of admin user emails")
    home_page_repository: Optional[str] = Field(
        None, description="Repository ID for home page"
    )
    home_page_article: Optional[str] = Field(
        None, description="Article path for home page"
    )


class SearchConfig(BaseModel):
    """Search configuration section."""

    index_path: Optional[str] = Field(None, description="Path to Whoosh search index")
    rebuild_on_startup: Optional[bool] = Field(
        None, description="Rebuild search index on application startup"
    )


class MultiRepositoryConfig(BaseModel):
    """Multi-repository configuration section."""

    auto_sync_interval_minutes: Optional[int] = Field(
        None, ge=1, le=1440, description="Auto-sync interval in minutes (max 24 hours)"
    )
    author_name: Optional[str] = Field(None, description="Git commit author name")
    author_email: Optional[str] = Field(None, description="Git commit author email")
    default_branch: Optional[str] = Field(
        None, description="Default branch for new repositories"
    )
    repositories_root_dir: Optional[str] = Field(
        None, description="Root directory where repositories are stored"
    )


class ConfigUpdate(BaseModel):
    """Configuration update request. All fields optional for partial updates."""

    app: Optional[AppConfig] = Field(None, description="Application settings")
    search: Optional[SearchConfig] = Field(None, description="Search settings")
    multi_repository: Optional[MultiRepositoryConfig] = Field(
        None, description="Multi-repository settings"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "app": {
                    "name": "WikiGit",
                    "description": "Git-based Wiki",
                    "domain": "wiki.example.com",
                    "max_file_size_mb": 10,
                    "admins": ["admin@example.com"],
                },
                "search": {"index_path": "/path/to/search-index"},
                "multi_repository": {
                    "auto_sync_interval_minutes": 15,
                    "author_name": "WikiGit Bot",
                    "author_email": "bot@wikigit.app",
                    "default_branch": "main",
                    "repositories_root_dir": "/path/to/repositories",
                },
            }
        }
    }


class ConfigData(BaseModel):
    """Simplified configuration data for frontend. Repository settings managed via /repositories."""

    app_name: str
    admins: List[str]
    index_dir: str
    home_page_repository: Optional[str] = None
    home_page_article: Optional[str] = None
    # Multi-repository settings
    auto_sync_interval_minutes: int
    author_name: str
    author_email: str
    default_branch: str
    repositories_root_dir: str


class ConfigResponse(BaseModel):
    """Complete configuration response model."""

    app: AppConfig
    search: SearchConfig

    model_config = {"from_attributes": True}


# ============================================================================
# Health Check Models
# ============================================================================


class HealthCheck(BaseModel):
    """Health check response model."""

    status: Literal["healthy", "unhealthy"] = Field(
        ..., description="Service health status"
    )
    version: str = Field(..., description="API version")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Current server timestamp",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "healthy",
                "version": "0.1.0",
                "timestamp": "2025-11-21T10:00:00Z",
            }
        }
    }


# ============================================================================
# Media Models
# ============================================================================


class MediaFile(BaseModel):
    """Media file metadata."""

    filename: str = Field(..., description="Original filename")
    path: str = Field(..., description="Relative path from repository root")
    size: int = Field(..., description="File size in bytes", ge=0)
    content_type: str = Field(..., description="MIME type of the file")
    url: str = Field(..., description="URL to access/serve the file")

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "filename": "screenshot.png",
                "path": "media/screenshot.png",
                "size": 245678,
                "content_type": "image/png",
                "url": "/media/screenshot.png",
            }
        },
    }


class MediaListResponse(BaseModel):
    """Response model for listing media files."""

    files: List[MediaFile] = Field(..., description="List of media files")

    model_config = {
        "json_schema_extra": {
            "example": {
                "files": [
                    {
                        "filename": "diagram.svg",
                        "path": "media/diagram.svg",
                        "size": 12456,
                        "content_type": "image/svg+xml",
                        "url": "/media/diagram.svg",
                    },
                    {
                        "filename": "video.mp4",
                        "path": "media/video.mp4",
                        "size": 2456789,
                        "content_type": "video/mp4",
                        "url": "/media/video.mp4",
                    },
                ]
            }
        },
    }


# ============================================================================
# Error Response Models
# ============================================================================


class ErrorDetail(BaseModel):
    """Error detail information."""

    field: Optional[str] = Field(None, description="Field name if applicable")
    message: str = Field(..., description="Error message")
    type: Optional[str] = Field(None, description="Error type")


class ErrorResponse(BaseModel):
    """Standard error response model."""

    detail: str = Field(..., description="Error description")
    errors: Optional[List[ErrorDetail]] = Field(
        None, description="Detailed error information"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "detail": "Validation error",
                "errors": [
                    {
                        "field": "path",
                        "message": "Article path must end with .md extension",
                        "type": "value_error",
                    }
                ],
            }
        }
    }


# ============================================================================
# User Models (for authentication context)
# ============================================================================


class User(BaseModel):
    """User from GCP IAP headers."""

    email: str = Field(..., description="User email from IAP header")
    is_admin: bool = Field(
        default=False, description="Whether user is in admin_users list"
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {"email": "user@example.com", "is_admin": False}
        },
    }

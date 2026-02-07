"""Repository, sync, and GitHub Pydantic models."""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Multi-Repository Models
# ============================================================================


class RepositoryMetadata(BaseModel):
    """Repository configuration for multi-repository mode."""

    id: str = Field(..., description="Unique repository identifier")
    name: str = Field(..., description="Display name for the repository")
    owner: str = Field(..., description="Repository owner (GitHub username/org)")
    remote_url: str = Field(..., description="GitHub repository URL")
    enabled: bool = Field(default=True, description="Whether repository is active")
    read_only: bool = Field(
        default=False, description="Whether repository is read-only"
    )
    default_branch: str = Field(
        default="main", description="Default branch for the repository"
    )
    last_synced: Optional[datetime] = Field(
        None, description="Last successful sync timestamp"
    )
    sync_status: Literal["synced", "pending", "error", "never", "unavailable"] = Field(
        default="never", description="Current sync status"
    )
    error_message: Optional[str] = Field(None, description="Last sync error message")

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "wiki-main",
                "name": "Main Wiki",
                "owner": "org",
                "remote_url": "https://github.com/org/wiki-main.git",
                "enabled": True,
                "read_only": False,
                "default_branch": "main",
                "last_synced": "2025-11-23T10:00:00Z",
                "sync_status": "synced",
                "error_message": None,
            }
        },
    }


class RepositoryCreate(BaseModel):
    """Request model for creating/cloning a repository."""

    remote_url: str = Field(..., description="GitHub repository URL to clone")
    name: Optional[str] = Field(
        None, description="Display name (derived from URL if not provided)"
    )
    enabled: bool = Field(default=True, description="Enable repository on creation")
    read_only: bool = Field(default=False, description="Set as read-only")

    @field_validator("remote_url")
    @classmethod
    def validate_github_url(cls, v: str) -> str:
        """Validate that URL is a valid GitHub repository URL."""
        if not v.startswith(("https://github.com/", "git@github.com:")):
            raise ValueError("Only GitHub repository URLs are supported")
        return v


class RepositoryUpdate(BaseModel):
    """Request model for updating repository settings."""

    name: Optional[str] = Field(None, description="Update display name")
    enabled: Optional[bool] = Field(None, description="Enable/disable repository")
    read_only: Optional[bool] = Field(None, description="Set read-only status")


class GitHubRepository(BaseModel):
    """GitHub repository information from scan."""

    full_name: str = Field(..., description="Repository full name (owner/repo)")
    name: str = Field(..., description="Repository name")
    clone_url: str = Field(..., description="HTTPS clone URL")
    private: bool = Field(..., description="Whether repository is private")
    description: Optional[str] = Field(None, description="Repository description")

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "full_name": "org/wiki-docs",
                "name": "wiki-docs",
                "clone_url": "https://github.com/org/wiki-docs.git",
                "private": True,
                "description": "Internal documentation wiki",
            }
        },
    }


class GitHubScanResponse(BaseModel):
    """Response model for GitHub repository scan."""

    repositories: List[GitHubRepository] = Field(
        default_factory=list, description="List of accessible repositories"
    )
    total: int = Field(..., ge=0, description="Total number of repositories found")

    model_config = {
        "json_schema_extra": {
            "example": {
                "repositories": [
                    {
                        "full_name": "org/wiki-docs",
                        "name": "wiki-docs",
                        "clone_url": "https://github.com/org/wiki-docs.git",
                        "private": True,
                        "description": "Internal documentation",
                    }
                ],
                "total": 1,
            }
        }
    }


class RepositoryStatus(BaseModel):
    """Repository status with sync information."""

    id: str = Field(..., description="Repository identifier")
    name: str = Field(..., description="Repository name")
    owner: str = Field(..., description="Repository owner")
    remote_url: str = Field(..., description="Remote Git URL")
    enabled: bool = Field(..., description="Whether repository is enabled")
    read_only: bool = Field(..., description="Whether repository is read-only")
    default_branch: str = Field(..., description="Default branch")
    last_synced: Optional[datetime] = Field(..., description="Last sync timestamp")
    sync_status: Literal["synced", "pending", "error", "never", "unavailable"] = Field(
        ..., description="Current sync status"
    )
    error_message: Optional[str] = Field(
        None, description="Error message if sync failed"
    )
    local_path: Optional[str] = Field(
        None, description="Local filesystem path (visible to admins)"
    )
    has_local_changes: bool = Field(
        default=False, description="Whether there are uncommitted local changes"
    )
    ahead_of_remote: int = Field(
        default=0, description="Number of commits ahead of remote"
    )
    behind_of_remote: int = Field(
        default=0, description="Number of commits behind remote"
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": "wiki-main",
                "name": "Main Wiki",
                "owner": "org",
                "remote_url": "https://github.com/org/wiki-main.git",
                "enabled": True,
                "read_only": False,
                "default_branch": "main",
                "last_synced": "2025-11-23T10:00:00Z",
                "sync_status": "synced",
                "error_message": None,
                "has_local_changes": False,
                "ahead_of_remote": 0,
                "behind_of_remote": 0,
            }
        },
    }


class RepositoryListResponse(BaseModel):
    """Response model for listing repositories."""

    repositories: List[RepositoryStatus] = Field(
        ..., description="List of repositories"
    )
    total: int = Field(..., ge=0, description="Total number of repositories")

    model_config = {
        "json_schema_extra": {
            "example": {
                "repositories": [
                    {
                        "id": "wiki-main",
                        "name": "Main Wiki",
                        "owner": "org",
                        "remote_url": "https://github.com/org/wiki-main.git",
                        "enabled": True,
                        "read_only": False,
                        "default_branch": "main",
                        "last_synced": "2025-11-23T10:00:00Z",
                        "sync_status": "synced",
                        "error_message": None,
                        "has_local_changes": False,
                        "ahead_of_remote": 0,
                        "behind_of_remote": 0,
                    }
                ],
                "total": 1,
            }
        }
    }


class RepositorySyncResponse(BaseModel):
    """Response from repository sync operation."""

    repository_id: str = Field(..., description="Repository identifier")
    status: Literal["success", "error"] = Field(..., description="Sync status")
    message: str = Field(..., description="Status message")
    commits_pulled: int = Field(default=0, description="Number of commits pulled")
    commits_pushed: int = Field(default=0, description="Number of commits pushed")
    files_changed: int = Field(default=0, description="Number of files changed")

    model_config = {
        "json_schema_extra": {
            "example": {
                "repository_id": "wiki-main",
                "status": "success",
                "message": "Synced successfully",
                "commits_pulled": 2,
                "commits_pushed": 1,
                "files_changed": 5,
            }
        }
    }


class SyncResult(BaseModel):
    """Result of a repository sync operation."""

    repository_id: str = Field(..., description="Repository identifier")
    status: Literal["success", "error"] = Field(..., description="Sync status")
    message: str = Field(..., description="Status message")
    files_changed: Optional[int] = Field(None, description="Number of files changed")
    reindexed: bool = Field(
        default=False, description="Whether search index was updated"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "repository_id": "wiki-main",
                "status": "success",
                "message": "Synced successfully",
                "files_changed": 3,
                "reindexed": True,
            }
        }
    }

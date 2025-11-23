"""
Pydantic models/schemas for WikiGit API.

Based on SRS v1.1 requirements for Git-based wiki application.
All models use Pydantic v2 syntax.
"""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================================================
# Article Models
# ============================================================================


class Article(BaseModel):
    """
    Article response model.

    Represents a complete article with metadata extracted from frontmatter
    and content without frontmatter.

    Ref: SRS Section 6.3.2 - Article Model
    """

    path: str = Field(
        ...,
        description="Relative path from repository root (e.g., 'README.md' or 'guides/install.md')",
    )
    title: str = Field(
        ..., description="Article title from frontmatter or derived from filename"
    )
    content: str = Field(..., description="Markdown content without frontmatter")
    author: Optional[str] = Field(
        None, description="Email of original creator from frontmatter"
    )
    created_at: Optional[datetime] = Field(
        None, description="Creation timestamp from frontmatter"
    )
    updated_at: Optional[datetime] = Field(
        None, description="Last update timestamp from frontmatter"
    )
    updated_by: Optional[str] = Field(
        None, description="Email of last editor from frontmatter"
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "path": "guides/getting-started.md",
                "title": "Getting Started",
                "content": "# Getting Started\n\nWelcome to WikiGit...",
                "author": "admin@example.com",
                "created_at": "2025-11-21T10:00:00Z",
                "updated_at": "2025-11-21T15:30:00Z",
                "updated_by": "editor@example.com",
            }
        },
    }


class ArticleCreate(BaseModel):
    """
    Article creation request model.

    Used when creating a new article. The title is optional and will be
    derived from the filename if not provided.

    Ref: SRS Section 6.5.3 - Create Article
    """

    path: str = Field(
        ...,
        description="Relative path ending in .md (e.g., 'new-article.md' or 'guides/tutorial.md')",
        min_length=1,
    )
    content: str = Field(
        ..., description="Markdown content for the article", min_length=1
    )
    title: Optional[str] = Field(
        None,
        description="Optional article title. If not provided, derived from filename",
    )

    @field_validator("path")
    @classmethod
    def validate_path_extension(cls, v: str) -> str:
        """Validate that path ends with .md extension (REQ-ART-010)."""
        if not v.endswith(".md"):
            raise ValueError("Article path must end with .md extension")
        return v

    @field_validator("path")
    @classmethod
    def validate_path_no_traversal(cls, v: str) -> str:
        """Prevent path traversal attacks (REQ-SEC-007)."""
        if ".." in v or v.startswith("/"):
            raise ValueError("Invalid path: path traversal not allowed")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "path": "guides/new-tutorial.md",
                "content": "# New Tutorial\n\nThis is a tutorial about...",
                "title": "New Tutorial",
            }
        }
    }


class ArticleUpdate(BaseModel):
    """
    Article update request model.

    Used when updating an existing article's content.
    The system automatically updates frontmatter metadata.

    Ref: SRS Section 6.5.4 - Update Article
    """

    content: str = Field(..., description="Updated markdown content", min_length=1)

    model_config = {
        "json_schema_extra": {
            "example": {
                "content": "# Updated Content\n\nThis article has been updated..."
            }
        }
    }


class ArticleMove(BaseModel):
    """
    Article move/rename request model.

    Used when moving or renaming an article.
    """

    new_path: str = Field(
        ...,
        description="New relative path (with or without .md extension)",
        min_length=1,
    )

    @field_validator("new_path")
    @classmethod
    def validate_path_no_traversal(cls, v: str) -> str:
        """Prevent path traversal attacks."""
        if ".." in v or v.startswith("/"):
            raise ValueError("Invalid path: contains '..' or starts with '/'")
        return v


class ArticleSummary(BaseModel):
    """
    Brief article information for list views.

    Used in article listing endpoints to avoid loading full content.
    """

    path: str = Field(..., description="Relative path from repository root")
    title: str = Field(..., description="Article title")
    author: Optional[str] = Field(
        None, description="Email of original creator from frontmatter"
    )
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    updated_by: Optional[str] = Field(
        None, description="Email of last editor from frontmatter"
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "path": "README.md",
                "title": "README",
                "author": "admin@example.com",
                "updated_at": "2025-11-21T10:00:00Z",
                "updated_by": "editor@example.com",
            }
        },
    }


class ArticleListResponse(BaseModel):
    """Response model for article listing."""

    articles: List[ArticleSummary] = Field(
        default_factory=list, description="List of article summaries"
    )


# ============================================================================
# Directory Models
# ============================================================================


class DirectoryNode(BaseModel):
    """
    Recursive directory tree node.

    Represents either a file or directory in the wiki structure.

    Ref: SRS Section 6.3.3 - Directory Model
    """

    type: Literal["directory", "file"] = Field(
        ..., description="Node type: 'directory' or 'file'"
    )
    name: str = Field(..., description="Name of the file or directory")
    path: str = Field(..., description="Relative path from repository root")
    children: Optional[List["DirectoryNode"]] = Field(
        None, description="Child nodes (only for directories)"
    )

    @model_validator(mode="after")
    def validate_children(self) -> "DirectoryNode":
        """Ensure only directories have children."""
        if self.type == "file" and self.children is not None:
            raise ValueError("Files cannot have children")
        if self.type == "directory" and self.children is None:
            # Initialize empty list for directories
            self.children = []
        return self

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "type": "directory",
                "name": "guides",
                "path": "guides",
                "children": [
                    {
                        "type": "file",
                        "name": "getting-started.md",
                        "path": "guides/getting-started.md",
                        "children": None,
                    }
                ],
            }
        },
    }


# Enable recursive model reference
DirectoryNode.model_rebuild()


class Directory(BaseModel):
    """
    Directory information with children.

    Ref: SRS Section 6.3.3 - Directory Model
    """

    path: str = Field(..., description="Relative path from repository root")
    name: str = Field(..., description="Directory name")
    children: List[DirectoryNode] = Field(
        default_factory=list, description="Child nodes in this directory"
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "path": "guides",
                "name": "guides",
                "children": [
                    {
                        "type": "file",
                        "name": "tutorial.md",
                        "path": "guides/tutorial.md",
                        "children": None,
                    }
                ],
            }
        },
    }


class DirectoryCreate(BaseModel):
    """
    Directory creation request model.

    Ref: SRS Section 4.4.2 - API Endpoints (Directories)
    """

    path: str = Field(
        ..., description="Relative directory path to create", min_length=1
    )

    @field_validator("path")
    @classmethod
    def validate_path_no_traversal(cls, v: str) -> str:
        """Prevent path traversal attacks (REQ-SEC-007)."""
        if ".." in v or v.startswith("/"):
            raise ValueError("Invalid path: path traversal not allowed")
        return v

    model_config = {"json_schema_extra": {"example": {"path": "guides/advanced"}}}


class DirectoryMove(BaseModel):
    """
    Directory move/rename request model.

    Used when moving or renaming a directory.
    """

    new_path: str = Field(
        ...,
        description="New relative directory path",
        min_length=1,
    )

    @field_validator("new_path")
    @classmethod
    def validate_path_no_traversal(cls, v: str) -> str:
        """Prevent path traversal attacks."""
        if ".." in v or v.startswith("/"):
            raise ValueError("Invalid path: contains '..' or starts with '/'")
        return v


class DirectoryTreeResponse(BaseModel):
    """Complete directory tree response."""

    tree: List[DirectoryNode] = Field(
        default_factory=list, description="Root-level directory tree"
    )


# ============================================================================
# Search Models
# ============================================================================


class SearchResult(BaseModel):
    """
    Individual search result.

    Ref: SRS Section 6.3.4 - Search Result Model
    """

    path: str = Field(..., description="Path to the article")
    title: str = Field(..., description="Article title")
    snippet: str = Field(..., description="Highlighted excerpt with matching terms")
    score: float = Field(
        ..., ge=0.0, le=1.0, description="Relevance score (0.0 to 1.0)"
    )
    repository_id: Optional[str] = Field(
        None, description="Repository ID (for multi-repository mode)"
    )
    repository_name: Optional[str] = Field(
        None, description="Repository name (for multi-repository mode)"
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "path": "guides/installation.md",
                "title": "Installation Guide",
                "snippet": "...install the <em>dependencies</em> using pnpm...",
                "score": 0.95,
                "repository_id": "wiki-main",
                "repository_name": "Main Wiki",
            }
        },
    }


class SearchResponse(BaseModel):
    """
    Search results response.

    Ref: SRS Section 6.5.6 - Search
    """

    query: str = Field(..., description="The search query that was executed")
    results: List[SearchResult] = Field(
        default_factory=list, description="List of matching articles"
    )
    total: int = Field(..., ge=0, description="Total number of results")

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "query": "installation guide",
                "results": [
                    {
                        "path": "guides/installation.md",
                        "title": "Installation Guide",
                        "snippet": "...install the <em>dependencies</em>...",
                        "score": 0.95,
                    }
                ],
                "total": 1,
            }
        },
    }


class IndexStats(BaseModel):
    """
    Search index statistics response.

    Returned after reindexing operations to show statistics.
    """

    status: str = Field(..., description="Status of the indexing operation")
    document_count: int = Field(..., ge=0, description="Number of documents indexed")
    message: str = Field(..., description="Human-readable status message")

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "status": "completed",
                "document_count": 42,
                "message": "Successfully indexed 42 articles",
            }
        },
    }


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
    """
    Configuration update request model.

    Allows admins to update application settings.
    All fields are optional to support partial updates.
    Repository settings are managed through /repositories endpoints.

    Ref: SRS Section 3.6 - Admin Configuration
    """

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
        default_factory=datetime.utcnow, description="Current server timestamp"
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
    """
    Media file information model.

    Represents metadata about a media file (image, video, audio, document).
    """

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
    """
    User information extracted from GCP IAP headers.

    Ref: SRS Section 3.1 - Authentication and Authorization
    """

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

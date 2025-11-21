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

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "path": "guides/installation.md",
                "title": "Installation Guide",
                "snippet": "...install the <em>dependencies</em> using pnpm...",
                "score": 0.95,
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


class RepositoryConfig(BaseModel):
    """Repository configuration section."""

    path: Optional[str] = Field(None, description="Local repository path")
    remote_url: Optional[str] = Field(None, description="Remote Git repository URL")
    auto_push: Optional[bool] = Field(
        None, description="Enable automatic push to remote"
    )
    github_token: Optional[str] = Field(None, description="GitHub authentication token")
    author_name: Optional[str] = Field(None, description="Git commit author name")
    author_email: Optional[str] = Field(None, description="Git commit author email")


class SearchConfig(BaseModel):
    """Search configuration section."""

    index_path: Optional[str] = Field(None, description="Path to Whoosh search index")
    rebuild_on_startup: Optional[bool] = Field(
        None, description="Rebuild search index on application startup"
    )


class ConfigUpdate(BaseModel):
    """
    Configuration update request model.

    Allows admins to update application settings.
    All fields are optional to support partial updates.

    Ref: SRS Section 3.6 - Admin Configuration
    """

    app: Optional[AppConfig] = Field(None, description="Application settings")
    repository: Optional[RepositoryConfig] = Field(
        None, description="Repository settings"
    )
    search: Optional[SearchConfig] = Field(None, description="Search settings")

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
                "repository": {
                    "remote_url": "https://github.com/user/wiki.git",
                    "auto_push": True,
                },
                "search": {"rebuild_on_startup": True},
            }
        }
    }


class ConfigData(BaseModel):
    """Simplified configuration data for frontend."""

    app_name: str
    admins: List[str]
    repo_path: str
    default_branch: str
    auto_push: bool
    remote_url: Optional[str] = None
    remote_token: Optional[str] = None
    index_dir: str


class ConfigResponse(BaseModel):
    """Complete configuration response model."""

    app: AppConfig
    repository: RepositoryConfig
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

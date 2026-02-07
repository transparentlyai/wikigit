"""Article, directory, and search Pydantic models."""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================================================
# Article Models
# ============================================================================


class Article(BaseModel):
    """Complete article with metadata and content."""

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
    warning: Optional[str] = None

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
    """Article creation request."""

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
    """Article update request."""

    content: str = Field(..., description="Updated markdown content", min_length=1)

    model_config = {
        "json_schema_extra": {
            "example": {
                "content": "# Updated Content\n\nThis article has been updated..."
            }
        }
    }


class ArticleMove(BaseModel):
    """Article move/rename request."""

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
    """Article summary for list views."""

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
    """Recursive directory tree node."""

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
    """Directory with children nodes."""

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
    """Directory creation request."""

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
    """Directory move/rename request."""

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
    """Individual search result."""

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
    """Search results response."""

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
    """Search index statistics."""

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

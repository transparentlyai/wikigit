"""Pydantic models for WikiGit API.

Re-exports all models from sub-modules for backward compatibility.
"""

from app.models.schemas.article import (
    Article,
    ArticleCreate,
    ArticleListResponse,
    ArticleMove,
    ArticleSummary,
    ArticleUpdate,
    Directory,
    DirectoryCreate,
    DirectoryMove,
    DirectoryNode,
    DirectoryTreeResponse,
    IndexStats,
    SearchResponse,
    SearchResult,
)
from app.models.schemas.config import (
    AppConfig,
    ConfigData,
    ConfigResponse,
    ConfigUpdate,
    ErrorDetail,
    ErrorResponse,
    HealthCheck,
    MediaFile,
    MediaListResponse,
    MultiRepositoryConfig,
    SearchConfig,
    User,
)
from app.models.schemas.repository import (
    GitHubRepository,
    GitHubScanResponse,
    RepositoryCreate,
    RepositoryListResponse,
    RepositoryMetadata,
    RepositoryStatus,
    RepositorySyncResponse,
    RepositoryUpdate,
    SyncResult,
)

__all__ = [
    # Article models
    "Article",
    "ArticleCreate",
    "ArticleListResponse",
    "ArticleMove",
    "ArticleSummary",
    "ArticleUpdate",
    # Directory models
    "Directory",
    "DirectoryCreate",
    "DirectoryMove",
    "DirectoryNode",
    "DirectoryTreeResponse",
    # Search models
    "IndexStats",
    "SearchResponse",
    "SearchResult",
    # Config models
    "AppConfig",
    "ConfigData",
    "ConfigResponse",
    "ConfigUpdate",
    "MultiRepositoryConfig",
    "SearchConfig",
    # Health
    "HealthCheck",
    # Media
    "MediaFile",
    "MediaListResponse",
    # Error
    "ErrorDetail",
    "ErrorResponse",
    # User
    "User",
    # Repository models
    "GitHubRepository",
    "GitHubScanResponse",
    "RepositoryCreate",
    "RepositoryListResponse",
    "RepositoryMetadata",
    "RepositoryStatus",
    "RepositorySyncResponse",
    "RepositoryUpdate",
    "SyncResult",
]

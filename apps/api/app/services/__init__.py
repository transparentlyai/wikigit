"""
WikiGit services package.

This package contains business logic services for the WikiGit API.
"""

from app.config.settings import settings
from app.services.frontmatter_service import FrontmatterService
from app.services.repository_service import RepositoryService

# Singleton instances
REPOSITORIES_CONFIG_PATH = (
    settings.multi_repository.root_dir / "config" / "repositories.json"
)
repository_service = RepositoryService(REPOSITORIES_CONFIG_PATH)
frontmatter_service = FrontmatterService()

__all__ = [
    "FrontmatterService",
    "RepositoryService",
    "repository_service",
    "frontmatter_service",
]

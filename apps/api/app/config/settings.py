"""
Configuration management for WikiGit using pydantic-settings-yaml.

This module provides:
- Pydantic models for all configuration sections
- YAML config file loading with validation
- Environment variable substitution (${VAR} syntax)
- Singleton settings instance for application-wide access
"""

import os
import re
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator
from pydantic_settings_yaml import YamlBaseSettings


def expand_env_vars(value: str) -> str:
    """
    Expand environment variables in strings using ${VAR} syntax.

    Args:
        value: String potentially containing ${VAR} patterns

    Returns:
        String with environment variables expanded

    Examples:
        >>> os.environ['GITHUB_TOKEN'] = 'ghp_123'
        >>> expand_env_vars('${GITHUB_TOKEN}')
        'ghp_123'
        >>> expand_env_vars('https://${USER}@github.com')
        'https://john@github.com'
    """
    if not isinstance(value, str):
        return value

    # Find all ${VAR} patterns
    pattern = re.compile(r"\$\{([^}]+)\}")

    def replace_var(match):
        var_name = match.group(1)
        return os.environ.get(var_name, match.group(0))

    return pattern.sub(replace_var, value)


class AppSettings(BaseModel):
    """Application-level settings."""

    model_config = {"populate_by_name": True}

    name: str = Field(
        default="WikiGit", alias="app_name", description="Application name"
    )
    description: str = Field(
        default="Git-based Wiki Application", description="Application description"
    )
    domain: str = Field(default="localhost:3003", description="Application domain")
    max_file_size_mb: int = Field(
        default=10, ge=1, le=100, description="Maximum file upload size in megabytes"
    )
    admins: list[str] = Field(
        default_factory=list,
        description="List of admin user emails (from GCP IAP or other auth)",
    )
    home_page_repository: Optional[str] = Field(
        default=None,
        description="Repository ID for home page (e.g., 'owner/repo')",
    )
    home_page_article: Optional[str] = Field(
        default=None,
        description="Article path for home page (e.g., 'home.md')",
    )

    @property
    def max_file_size_bytes(self) -> int:
        """Get max file size in bytes."""
        return self.max_file_size_mb * 1024 * 1024


class SearchSettings(BaseModel):
    """Search index settings."""

    model_config = {"populate_by_name": True}

    index_path: str = Field(
        default="./data/whoosh_index",
        alias="index_dir",
        description="Path to the Whoosh search index directory",
    )
    rebuild_on_startup: bool = Field(
        default=True, description="Rebuild search index on application startup"
    )

    @field_validator("index_path", mode="before")
    @classmethod
    def expand_path_env_vars(cls, v: str) -> str:
        """Expand environment variables in path."""
        return expand_env_vars(v)

    @property
    def index_dir(self) -> Path:
        """Get index path as Path object."""
        return Path(self.index_path).resolve()


class GitHubSettings(BaseModel):
    """GitHub authentication settings for multi-repository support."""

    model_config = {"populate_by_name": True}

    token_env_var: str = Field(
        default="GITHUB_TOKEN",
        description="Environment variable name containing GitHub Personal Access Token",
    )
    user_id: str = Field(..., description="GitHub user ID for API authentication")

    @property
    def token(self) -> Optional[str]:
        """Get GitHub token from environment variable."""
        return os.environ.get(self.token_env_var)


class RepositoryConfig(BaseModel):
    """
    Configuration model for a single repository.

    Used for runtime validation when loading repository data from repositories.json.
    Managed by RepositoryService, not YAML configuration.
    """

    model_config = {"populate_by_name": True}

    id: str = Field(..., description="Repository identifier in 'owner/repo' format")
    name: str = Field(..., description="Repository name (just 'repo' part)")
    owner: str = Field(..., description="Repository owner/organization")
    remote_url: str = Field(..., description="Full remote repository URL")
    local_path: str = Field(
        ...,
        description="Local path relative to repositories_root_dir (typically 'owner/repo')",
    )
    enabled: bool = Field(
        default=True,
        description="Whether this repository is enabled for indexing and sync",
    )
    read_only: bool = Field(
        default=True,
        description="Whether this repository is read-only (no push operations)",
    )
    default_branch: str = Field(
        default="main", description="Default branch to use for this repository"
    )
    last_synced: Optional[datetime] = Field(
        default=None, description="Timestamp of last successful sync"
    )
    sync_status: Literal["synced", "pending", "error", "never", "unavailable"] = Field(
        default="never", description="Current sync status of the repository"
    )
    error_message: Optional[str] = Field(
        default=None, description="Error message if sync_status is 'error'"
    )


class MultiRepositorySettings(BaseModel):
    """
    Multi-repository support configuration.

    Repositories are managed via RepositoryService (repositories.json),
    not through YAML configuration.
    """

    model_config = {"populate_by_name": True}

    enabled: bool = Field(default=True, description="Enable multi-repository support")
    repositories_root_dir: str = Field(
        default="./wiki-repositories",
        description="Root directory where all repositories are cloned",
    )
    auto_sync_interval_minutes: int = Field(
        default=15,
        ge=1,
        description="Interval in minutes between automatic repository syncs",
    )
    author_name: str = Field(
        default="WikiGit Bot", description="Git commit author name"
    )
    author_email: str = Field(
        default="bot@wikigit.app", description="Git commit author email"
    )
    default_branch: str = Field(default="main", description="Default git branch to use")
    github: Optional[GitHubSettings] = Field(
        default=None, description="GitHub authentication settings"
    )

    @field_validator("repositories_root_dir", mode="before")
    @classmethod
    def expand_path_env_vars(cls, v: str) -> str:
        """Expand environment variables in path."""
        return expand_env_vars(v)

    @property
    def root_dir(self) -> Path:
        """Get repositories root directory as Path object."""
        return Path(self.repositories_root_dir).resolve()


class Settings(YamlBaseSettings):
    """
    Main settings class that loads configuration from YAML file.

    This class uses pydantic-settings-yaml to load settings from config.yaml
    located at the project root (three levels up from this file).

    Environment variables in the YAML file using ${VAR} syntax will be
    automatically expanded.
    """

    app: AppSettings = Field(default_factory=AppSettings)
    search: SearchSettings = Field(default_factory=SearchSettings)
    multi_repository: MultiRepositorySettings = Field(
        default_factory=MultiRepositorySettings
    )

    class Config:
        """Pydantic configuration."""

        # Path to config.yaml (five levels up from this file to project root)
        yaml_file = Path(__file__).parent.parent.parent.parent.parent / "config.yaml"

        # Allow extra fields to be ignored
        extra = "ignore"

        # Validate on assignment
        validate_assignment = True

    def is_admin(self, email: str) -> bool:
        """
        Check if a user email is an admin.

        Args:
            email: User email address

        Returns:
            True if user is an admin, False otherwise
        """
        return email in self.app.admins

    @property
    def config_file_path(self) -> Path:
        """Get the path to the config file."""
        return self.Config.yaml_file

    @property
    def config_exists(self) -> bool:
        """Check if config file exists."""
        return self.Config.yaml_file.exists()


def get_settings() -> Settings:
    """
    Get or create the singleton settings instance.

    This function ensures only one Settings instance is created and reused
    throughout the application lifecycle.

    Returns:
        Settings instance loaded from config.yaml

    Raises:
        FileNotFoundError: If config.yaml doesn't exist
        ValueError: If config.yaml has validation errors
    """
    import logging

    logger = logging.getLogger(__name__)

    config_path = Path(__file__).parent.parent.parent.parent.parent / "config.yaml"

    if not config_path.exists():
        error_msg = (
            f"Configuration file not found: {config_path}\n"
            f"Please copy config.yaml.example to config.yaml and customize it."
        )
        logger.error(error_msg)
        raise FileNotFoundError(error_msg)

    try:
        logger.info(f"Loading configuration from: {config_path}")
        settings_instance = Settings()

        # Validate critical configuration
        errors = []

        # Validate at least one admin is configured
        if not settings_instance.app.admins:
            errors.append("No admin users configured in app.admins")
        else:
            # Validate admin email formats
            for email in settings_instance.app.admins:
                if "@" not in email or "." not in email.split("@")[1]:
                    errors.append(f"Invalid admin email format: {email}")

        # If there are validation errors, fail fast
        if errors:
            error_msg = "\n".join(
                [
                    "Configuration validation failed:",
                    *errors,
                    f"\nPlease fix the errors in: {config_path}",
                ]
            )
            logger.error(error_msg)
            raise ValueError(error_msg)

        logger.info("Configuration loaded successfully")
        logger.info("   Multi-repository mode: enabled")
        logger.info(
            f"   Repositories root: {settings_instance.multi_repository.root_dir}"
        )
        logger.info(f"   Search index: {settings_instance.search.index_dir}")
        logger.info(f"   Admins: {len(settings_instance.app.admins)} configured")

        return settings_instance

    except ValueError:
        # Re-raise validation errors
        raise
    except Exception as e:
        error_msg = f"Failed to load configuration from {config_path}: {e}"
        logger.error(error_msg)
        raise ValueError(error_msg) from e


# Singleton settings instance
# Import this in your application code: from app.config.settings import settings
settings = get_settings()


__all__ = [
    "AppSettings",
    "SearchSettings",
    "GitHubSettings",
    "RepositoryConfig",
    "MultiRepositorySettings",
    "Settings",
    "get_settings",
    "settings",
    "expand_env_vars",
]

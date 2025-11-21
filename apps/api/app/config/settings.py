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
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings
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
    pattern = re.compile(r'\$\{([^}]+)\}')

    def replace_var(match):
        var_name = match.group(1)
        return os.environ.get(var_name, match.group(0))

    return pattern.sub(replace_var, value)


class AppSettings(BaseModel):
    """Application-level settings."""

    model_config = {"populate_by_name": True}

    name: str = Field(
        default="WikiGit",
        alias="app_name",
        description="Application name"
    )
    description: str = Field(
        default="Git-based Wiki Application",
        description="Application description"
    )
    domain: str = Field(
        default="localhost:3003",
        description="Application domain"
    )
    max_file_size_mb: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Maximum file upload size in megabytes"
    )
    admins: list[str] = Field(
        default_factory=list,
        description="List of admin user emails (from GCP IAP or other auth)"
    )

    @property
    def max_file_size_bytes(self) -> int:
        """Get max file size in bytes."""
        return self.max_file_size_mb * 1024 * 1024


class RepositorySettings(BaseModel):
    """Git repository settings."""

    model_config = {"populate_by_name": True}

    path: str = Field(
        default="./wiki-content",
        alias="repo_path",
        description="Path to the git repository directory"
    )
    default_branch: str = Field(
        default="main",
        description="Default git branch to use"
    )
    remote_url: Optional[str] = Field(
        default=None,
        description="Optional remote repository URL (e.g., https://github.com/user/repo.git)"
    )
    remote_token: Optional[str] = Field(
        default=None,
        description="Remote repository access token for authentication"
    )
    auto_push: bool = Field(
        default=False,
        description="Automatically push to remote on every commit"
    )
    github_token: Optional[str] = Field(
        default=None,
        description="GitHub personal access token for authentication (deprecated, use remote_token)"
    )
    author_name: str = Field(
        default="WikiGit Bot",
        description="Git commit author name"
    )
    author_email: str = Field(
        default="bot@wikigit.app",
        description="Git commit author email"
    )

    @field_validator('remote_url', 'remote_token', 'github_token', mode='before')
    @classmethod
    def expand_env_variables(cls, v: Optional[str]) -> Optional[str]:
        """Expand environment variables in string fields."""
        if v is None or v == "":
            return None
        return expand_env_vars(v)

    @field_validator('path', mode='before')
    @classmethod
    def expand_path_env_vars(cls, v: str) -> str:
        """Expand environment variables in path."""
        return expand_env_vars(v)

    @property
    def repo_path(self) -> Path:
        """Get repository path as Path object."""
        return Path(self.path).resolve()

    @property
    def has_remote(self) -> bool:
        """Check if remote repository is configured."""
        return self.remote_url is not None and self.remote_url != ""

    @property
    def has_github_token(self) -> bool:
        """Check if GitHub token is configured."""
        return self.github_token is not None and self.github_token != ""


class SearchSettings(BaseModel):
    """Search index settings."""

    model_config = {"populate_by_name": True}

    index_path: str = Field(
        default="./data/whoosh_index",
        alias="index_dir",
        description="Path to the Whoosh search index directory"
    )
    rebuild_on_startup: bool = Field(
        default=True,
        description="Rebuild search index on application startup"
    )

    @field_validator('index_path', mode='before')
    @classmethod
    def expand_path_env_vars(cls, v: str) -> str:
        """Expand environment variables in path."""
        return expand_env_vars(v)

    @property
    def index_dir(self) -> Path:
        """Get index path as Path object."""
        return Path(self.index_path).resolve()


class Settings(YamlBaseSettings):
    """
    Main settings class that loads configuration from YAML file.

    This class uses pydantic-settings-yaml to load settings from config.yaml
    located at the project root (three levels up from this file).

    Environment variables in the YAML file using ${VAR} syntax will be
    automatically expanded.
    """

    app: AppSettings = Field(default_factory=AppSettings)
    repository: RepositorySettings = Field(default_factory=RepositorySettings)
    search: SearchSettings = Field(default_factory=SearchSettings)

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

        # Validate repository path exists or can be created
        repo_path = settings_instance.repository.repo_path
        if not repo_path.exists():
            logger.warning(f"Repository path does not exist: {repo_path}")
            logger.warning("It will be created on first use")

        # Validate at least one admin is configured
        if not settings_instance.app.admins:
            errors.append("No admin users configured in app.admins")
        else:
            # Validate admin email formats
            for email in settings_instance.app.admins:
                if "@" not in email or "." not in email.split("@")[1]:
                    errors.append(f"Invalid admin email format: {email}")

        # Validate auto_push requires remote_url
        if settings_instance.repository.auto_push and not settings_instance.repository.remote_url:
            errors.append("auto_push is enabled but remote_url is not configured")

        # Validate remote_url format if provided
        if settings_instance.repository.remote_url:
            remote = settings_instance.repository.remote_url
            if not (remote.startswith("http://") or remote.startswith("https://") or remote.startswith("git@")):
                errors.append(f"Invalid remote_url format: {remote}")

        # If there are validation errors, fail fast
        if errors:
            error_msg = "\n".join([
                "Configuration validation failed:",
                *errors,
                f"\nPlease fix the errors in: {config_path}"
            ])
            logger.error(error_msg)
            raise ValueError(error_msg)

        logger.info("Configuration loaded successfully")
        logger.info(f"   Repository: {settings_instance.repository.repo_path}")
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
    "RepositorySettings",
    "SearchSettings",
    "Settings",
    "get_settings",
    "settings",
    "expand_env_vars",
]

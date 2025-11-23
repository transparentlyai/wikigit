"""
Configuration management endpoints for WikiGit API.

This module provides endpoints for viewing and updating application configuration.
Repository-specific settings are managed through the /repositories endpoints.
"""

import logging
from pathlib import Path

import yaml
from fastapi import APIRouter, Depends, HTTPException, status

from app.config.settings import settings
from app.middleware.auth import require_admin
from app.models.schemas import ConfigData, ConfigUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/config", tags=["config"])


@router.get("", response_model=ConfigData)
async def get_config(_user: str = Depends(require_admin)):
    """
    Get current application configuration.

    Returns the current configuration settings including app name, admins,
    search settings, and multi-repository settings. Repository settings are
    managed through /repositories endpoints.

    Requires admin privileges.

    Returns:
        ConfigData: Current configuration

    Raises:
        HTTPException: If reading configuration fails
    """
    try:
        return ConfigData(
            app_name=settings.app.name,
            admins=settings.app.admins,
            index_dir=str(settings.search.index_dir),
            home_page_repository=settings.app.home_page_repository,
            home_page_article=settings.app.home_page_article,
            auto_sync_interval_minutes=settings.multi_repository.auto_sync_interval_minutes,
            author_name=settings.multi_repository.author_name,
            author_email=settings.multi_repository.author_email,
            default_branch=settings.multi_repository.default_branch,
            repositories_root_dir=str(settings.multi_repository.root_dir),
        )

    except Exception as e:
        logger.error(f"Failed to get configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get configuration: {str(e)}",
        )


@router.put("", response_model=ConfigData)
async def update_config(
    config_update: ConfigUpdate, _user: str = Depends(require_admin)
):
    """
    Update application configuration.

    Updates the config.yaml file with new settings. Only provided fields
    are updated; omitted fields retain their current values.

    Most settings are auto-reloaded. Settings that require restart:
    - repositories_root_dir
    - search.index_dir

    Repository settings are managed through /repositories endpoints.

    Requires admin privileges.

    Args:
        config_update: Configuration update data

    Returns:
        ConfigData: Updated configuration

    Raises:
        HTTPException: If configuration update fails
    """
    try:
        config_file = Path(__file__).parent.parent.parent.parent.parent / "config.yaml"
        if not config_file.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration file not found at {config_file.absolute()}. Please create config.yaml from config.yaml.example",
            )

        with open(config_file, "r") as f:
            config_data = yaml.safe_load(f)

        # Track if restart is needed
        restart_required = False

        # Update app settings
        if config_update.app is not None:
            if "app" not in config_data:
                config_data["app"] = {}

            app_updates = config_update.app.model_dump(exclude_unset=True)

            if "name" in app_updates:
                config_data["app"]["app_name"] = app_updates["name"]
            if "admins" in app_updates:
                config_data["app"]["admins"] = app_updates["admins"]
            if "home_page_repository" in app_updates:
                config_data["app"]["home_page_repository"] = app_updates[
                    "home_page_repository"
                ]
            if "home_page_article" in app_updates:
                config_data["app"]["home_page_article"] = app_updates[
                    "home_page_article"
                ]

        # Update search settings
        if config_update.search is not None:
            if "search" not in config_data:
                config_data["search"] = {}

            search_updates = config_update.search.model_dump(exclude_unset=True)

            if "index_path" in search_updates:
                new_path = Path(search_updates["index_path"])
                # Create directory if it doesn't exist
                new_path.mkdir(parents=True, exist_ok=True)
                config_data["search"]["index_dir"] = str(new_path.absolute())
                restart_required = True

        # Update multi-repository settings
        if config_update.multi_repository is not None:
            if "multi_repository" not in config_data:
                config_data["multi_repository"] = {}

            mr_updates = config_update.multi_repository.model_dump(exclude_unset=True)

            if "auto_sync_interval_minutes" in mr_updates:
                config_data["multi_repository"]["auto_sync_interval_minutes"] = (
                    mr_updates["auto_sync_interval_minutes"]
                )
            if "author_name" in mr_updates:
                config_data["multi_repository"]["author_name"] = mr_updates[
                    "author_name"
                ]
            if "author_email" in mr_updates:
                config_data["multi_repository"]["author_email"] = mr_updates[
                    "author_email"
                ]
            if "default_branch" in mr_updates:
                config_data["multi_repository"]["default_branch"] = mr_updates[
                    "default_branch"
                ]
            if "repositories_root_dir" in mr_updates:
                new_path = Path(mr_updates["repositories_root_dir"])
                # Create directory if it doesn't exist
                new_path.mkdir(parents=True, exist_ok=True)
                config_data["multi_repository"]["repositories_root_dir"] = str(
                    new_path.absolute()
                )
                restart_required = True

        # Write updated config to file
        with open(config_file, "w") as f:
            yaml.safe_dump(config_data, f, default_flow_style=False)

        logger.info("Configuration file updated successfully")

        # Auto-reload in-memory settings (except those requiring restart)
        if config_update.app is not None:
            settings.app.name = config_data["app"].get("app_name", settings.app.name)
            settings.app.admins = config_data["app"].get("admins", settings.app.admins)
            settings.app.home_page_repository = config_data["app"].get(
                "home_page_repository"
            )
            settings.app.home_page_article = config_data["app"].get("home_page_article")

        if config_update.multi_repository is not None:
            if "auto_sync_interval_minutes" in config_data.get("multi_repository", {}):
                settings.multi_repository.auto_sync_interval_minutes = config_data[
                    "multi_repository"
                ]["auto_sync_interval_minutes"]
            if "author_name" in config_data.get("multi_repository", {}):
                settings.multi_repository.author_name = config_data["multi_repository"][
                    "author_name"
                ]
            if "author_email" in config_data.get("multi_repository", {}):
                settings.multi_repository.author_email = config_data[
                    "multi_repository"
                ]["author_email"]
            if "default_branch" in config_data.get("multi_repository", {}):
                settings.multi_repository.default_branch = config_data[
                    "multi_repository"
                ]["default_branch"]
            # Note: repositories_root_dir requires restart, don't reload

        if restart_required:
            logger.warning(
                "Configuration updated. RESTART REQUIRED for directory path changes to take effect."
            )
        else:
            logger.info("In-memory configuration updated (no restart required)")

        # Return updated configuration
        return ConfigData(
            app_name=config_data["app"]["app_name"],
            admins=config_data["app"]["admins"],
            index_dir=config_data["search"]["index_dir"],
            home_page_repository=config_data["app"].get("home_page_repository"),
            home_page_article=config_data["app"].get("home_page_article"),
            auto_sync_interval_minutes=config_data["multi_repository"][
                "auto_sync_interval_minutes"
            ],
            author_name=config_data["multi_repository"]["author_name"],
            author_email=config_data["multi_repository"]["author_email"],
            default_branch=config_data["multi_repository"]["default_branch"],
            repositories_root_dir=config_data["multi_repository"][
                "repositories_root_dir"
            ],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update configuration: {str(e)}",
        )

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
    and search settings. Repository settings are managed through /repositories endpoints.

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

        if config_update.app is not None:
            if "app" not in config_data:
                config_data["app"] = {}
            if config_update.app.name is not None:
                config_data["app"]["app_name"] = config_update.app.name
            if config_update.app.admins is not None:
                config_data["app"]["admins"] = config_update.app.admins
            if config_update.app.home_page_repository is not None:
                config_data["app"]["home_page_repository"] = (
                    config_update.app.home_page_repository
                )
            if config_update.app.home_page_article is not None:
                config_data["app"]["home_page_article"] = (
                    config_update.app.home_page_article
                )

        with open(config_file, "w") as f:
            yaml.safe_dump(config_data, f, default_flow_style=False)

        logger.info("Configuration file updated successfully")
        logger.warning(
            "Configuration updated. Restart the application to apply changes."
        )

        # Return updated configuration
        return ConfigData(
            app_name=config_data["app"]["app_name"],
            admins=config_data["app"]["admins"],
            index_dir=config_data["search"]["index_dir"],
            home_page_repository=config_data["app"].get("home_page_repository"),
            home_page_article=config_data["app"].get("home_page_article"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update configuration: {str(e)}",
        )

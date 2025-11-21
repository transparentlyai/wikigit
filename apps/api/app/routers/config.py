"""
Configuration management endpoints for WikiGit API.

This module provides endpoints for viewing and updating application configuration.
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
async def get_config(
    _user: str = Depends(require_admin)
):
    """
    Get current application configuration.

    Returns the current configuration settings including app name, admins,
    repository settings, and search settings.

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
            repo_path=str(settings.repository.repo_path),
            default_branch=settings.repository.default_branch,
            auto_push=settings.repository.auto_push,
            remote_url=settings.repository.remote_url,
            remote_token=settings.repository.remote_token,
            index_dir=str(settings.search.index_dir)
        )

    except Exception as e:
        logger.error(f"Failed to get configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get configuration: {str(e)}"
        )


@router.put("", response_model=ConfigData)
async def update_config(
    config_update: ConfigUpdate,
    _user: str = Depends(require_admin)
):
    """
    Update application configuration.

    Updates the config.yaml file with new settings. Only provided fields
    are updated; omitted fields retain their current values.

    Requires admin privileges.

    Args:
        config_update: Configuration update data

    Returns:
        ConfigData: Updated configuration

    Raises:
        HTTPException: If configuration update fails
    """
    try:
        # Read current config file
        config_file = Path("config.yaml")
        if not config_file.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Configuration file not found. Please create config.yaml from config.yaml.example"
            )

        with open(config_file, 'r') as f:
            config_data = yaml.safe_load(f)

        # Update fields if provided
        if config_update.app_name is not None:
            config_data['app']['app_name'] = config_update.app_name

        if config_update.admins is not None:
            config_data['app']['admins'] = config_update.admins

        if config_update.auto_push is not None:
            config_data['repository']['auto_push'] = config_update.auto_push

        if config_update.remote_url is not None:
            config_data['repository']['remote_url'] = config_update.remote_url

        if config_update.remote_token is not None:
            config_data['repository']['remote_token'] = config_update.remote_token

        # Write updated config back to file
        with open(config_file, 'w') as f:
            yaml.safe_dump(config_data, f, default_flow_style=False)

        logger.info("Configuration file updated successfully")

        # Note: Settings won't be reloaded until application restart
        logger.warning("Configuration updated. Restart the application to apply changes.")

        # Return updated configuration (from memory, not reloaded)
        return ConfigData(
            app_name=config_data['app']['app_name'],
            admins=config_data['app']['admins'],
            repo_path=config_data['repository']['repo_path'],
            default_branch=config_data['repository']['default_branch'],
            auto_push=config_data['repository']['auto_push'],
            remote_url=config_data['repository'].get('remote_url'),
            remote_token=config_data['repository'].get('remote_token'),
            index_dir=config_data['search']['index_dir']
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update configuration: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update configuration: {str(e)}"
        )

"""
Setup status endpoint for fresh installations.

Helps detect if WikiGit needs initial configuration.
"""

import logging

from fastapi import APIRouter

from app.config.settings import settings
from app.services.repository_service import RepositoryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/setup", tags=["setup"])


@router.get("/status")
async def get_setup_status():
    """
    Check if WikiGit is configured and ready to use.

    Returns:
        dict with setup_complete boolean and details about what needs configuration
    """
    issues = []

    # Check if GitHub is configured
    github_configured = False
    if settings.multi_repository.github and settings.multi_repository.github.user_id:
        github_configured = True
    else:
        issues.append("GitHub user ID not configured")

    # Check if any repositories are configured
    repos_config_path = settings.multi_repository.root_dir / "config" / "repositories.json"
    repository_service = RepositoryService(repos_config_path)
    repositories = repository_service.list_repositories()

    has_repositories = len(repositories) > 0
    if not has_repositories:
        issues.append("No repositories added")

    # Check if any repositories are enabled
    enabled_repos = [r for r in repositories if r.get("enabled", False)]
    has_enabled_repos = len(enabled_repos) > 0
    if has_repositories and not has_enabled_repos:
        issues.append("No repositories enabled")

    setup_complete = github_configured and has_enabled_repos

    return {
        "setup_complete": setup_complete,
        "github_configured": github_configured,
        "repository_count": len(repositories),
        "enabled_repository_count": len(enabled_repos),
        "issues": issues,
        "redirect_to": "/admin" if not setup_complete else None,
    }

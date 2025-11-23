"""
Repository sync scheduler service for WikiGit.

This module provides automatic background synchronization for all enabled
repositories using APScheduler. It runs periodic sync operations and
re-indexes repositories when files change.

Phase 3-5: Multi-Repository Support - Sync Scheduler
"""

import logging
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config.settings import settings
from app.services.multi_repo_git_service import MultiRepoGitService
from app.services.repository_service import RepositoryService
from app.services.search_service import SearchService

logger = logging.getLogger(__name__)


class SyncScheduler:
    """
    Scheduler for automatic repository synchronization.

    Manages periodic sync operations for all enabled repositories,
    including error handling and search index updates.
    """

    def __init__(self):
        """Initialize the sync scheduler."""
        self.scheduler = AsyncIOScheduler()
        self.repository_service: RepositoryService | None = None
        self._is_running = False

    def initialize(self, repository_service: RepositoryService):
        """
        Initialize the scheduler with repository service.

        Args:
            repository_service: Repository service instance to use for sync operations
        """
        self.repository_service = repository_service
        logger.info("Sync scheduler initialized")

    def start(self):
        """
        Start the scheduler if multi-repository mode is enabled.

        Adds the sync job with the configured interval and starts the scheduler.
        """
        if not settings.multi_repository.enabled:
            logger.info("Multi-repository mode disabled - sync scheduler not started")
            return

        if self.repository_service is None:
            logger.error("Cannot start scheduler: repository service not initialized")
            return

        if self._is_running:
            logger.warning("Sync scheduler already running")
            return

        # Get sync interval from settings (in minutes)
        interval_minutes = settings.multi_repository.auto_sync_interval_minutes

        # Add the sync job
        self.scheduler.add_job(
            self._sync_all_repositories,
            trigger=IntervalTrigger(minutes=interval_minutes),
            id="sync_all_repositories",
            name="Sync all enabled repositories",
            replace_existing=True,
        )

        # Start the scheduler
        self.scheduler.start()
        self._is_running = True

        logger.info(
            f"Sync scheduler started - will sync every {interval_minutes} minutes"
        )

    def stop(self):
        """Stop the scheduler gracefully."""
        if not self._is_running:
            logger.debug("Sync scheduler not running")
            return

        self.scheduler.shutdown(wait=True)
        self._is_running = False
        logger.info("Sync scheduler stopped")

    async def _sync_all_repositories(self):
        """
        Sync all enabled repositories.

        This is the main job function that runs on the configured interval.
        It syncs all enabled repositories and re-indexes those with changes.
        """
        if self.repository_service is None:
            logger.error("Repository service not initialized")
            return

        logger.info("Starting scheduled sync of all repositories")

        # Get all repositories
        try:
            repositories = self.repository_service.list_repositories()
        except Exception as e:
            logger.error(f"Failed to list repositories: {e}")
            return

        # Filter for enabled repositories
        enabled_repos = [repo for repo in repositories if repo.get("enabled", False)]

        if not enabled_repos:
            logger.info("No enabled repositories to sync")
            return

        logger.info(f"Found {len(enabled_repos)} enabled repositories to sync")

        # Sync each repository
        success_count = 0
        error_count = 0

        for repo in enabled_repos:
            repo_id = repo["id"]
            try:
                logger.debug(f"Syncing repository: {repo_id}")

                # Perform sync
                result = self.repository_service.sync_repository(
                    repo_id=repo_id,
                    author_name=settings.multi_repository.author_name,
                    author_email=settings.multi_repository.author_email,
                )

                if result["status"] == "success":
                    success_count += 1

                    # Re-index if files changed
                    files_changed = result.get("files_changed", 0)
                    if files_changed > 0:
                        logger.info(
                            f"Repository {repo_id} has {files_changed} changed files - re-indexing"
                        )
                        await self._reindex_repository(repo_id, repo["local_path"])
                    else:
                        logger.debug(f"Repository {repo_id} up to date - no changes")
                else:
                    error_count += 1
                    error_msg = result.get("message", "Unknown error")
                    logger.error(f"Failed to sync repository {repo_id}: {error_msg}")

            except Exception as e:
                error_count += 1
                logger.error(f"Error syncing repository {repo_id}: {e}", exc_info=True)

        logger.info(
            f"Sync completed - {success_count} successful, {error_count} errors"
        )

    async def _reindex_repository(self, repo_id: str, local_path: str):
        """
        Rebuild the entire multi-repository search index.

        This is triggered when a repository has changes. Since the search index
        is shared across all repositories, we rebuild the entire index to ensure
        consistency.

        Args:
            repo_id: Repository identifier (for logging purposes)
            local_path: Path to the local repository clone
        """
        try:
            repo_path = Path(local_path)
            if not repo_path.exists():
                logger.error(f"Repository path does not exist: {local_path}")
                return

            # Create search service and multi-repo service
            search_service = SearchService(
                search_settings=settings.search, repo_path=repo_path
            )
            multi_repo_service = MultiRepoGitService()

            # Rebuild the entire multi-repo search index
            document_count = search_service.rebuild_index(
                multi_repo_service=multi_repo_service
            )
            logger.info(
                f"Rebuilt multi-repo search index (triggered by {repo_id}): "
                f"{document_count} documents"
            )

        except Exception as e:
            logger.error(
                f"Failed to rebuild search index (triggered by {repo_id}): {e}",
                exc_info=True,
            )


# Global scheduler instance
_scheduler: SyncScheduler | None = None


def get_scheduler() -> SyncScheduler:
    """
    Get the global scheduler instance.

    Returns:
        SyncScheduler instance
    """
    global _scheduler
    if _scheduler is None:
        _scheduler = SyncScheduler()
    return _scheduler

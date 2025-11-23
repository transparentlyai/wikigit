"""
Repository service for multi-repository support in WikiGit.

This module provides management of multiple Git repositories including:
- Repository metadata management and persistence
- GitHub repository scanning (requires GitHub token)
- Repository sync operations (pull/push)
- Repository status tracking
- Error handling and logging

Phase 6: Multi-Repository Support
"""

import json
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from git import Repo
from git.exc import GitCommandError

logger = logging.getLogger(__name__)


class RepositoryService:
    """
    Service for managing multiple Git repositories.

    Handles repository metadata, sync operations, and status tracking
    across multiple repositories.
    """

    def __init__(self, repositories_config_path: Path):
        """
        Initialize repository service.

        Args:
            repositories_config_path: Path to store repository metadata JSON
        """
        self.config_path = repositories_config_path
        self.repositories: Dict[str, dict] = {}

        # Ensure config directory exists
        self.config_path.parent.mkdir(parents=True, exist_ok=True)

        # Load existing repositories from config
        self._load_repositories()

    def _load_repositories(self) -> None:
        """Load repositories from configuration file."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r") as f:
                    data = json.load(f)
                    self.repositories = data.get("repositories", {})
                    logger.info(
                        f"Loaded {len(self.repositories)} repositories from config"
                    )
            except Exception as e:
                logger.error(f"Failed to load repositories config: {e}")
                self.repositories = {}
        else:
            logger.info("No existing repositories config found")
            self.repositories = {}

    def _save_repositories(self) -> None:
        """Save repositories to configuration file."""
        try:
            with open(self.config_path, "w") as f:
                json.dump({"repositories": self.repositories}, f, indent=2, default=str)
            logger.debug("Repositories config saved")
        except Exception as e:
            logger.error(f"Failed to save repositories config: {e}")
            raise

    def add_repository(
        self,
        repo_id: str,
        name: str,
        owner: str,
        remote_url: str,
        local_path: Path,
        enabled: bool = False,
        read_only: bool = True,
        default_branch: str = "main",
    ) -> dict:
        """
        Add a new repository to the system.

        Args:
            repo_id: Unique repository identifier
            name: Display name
            owner: Repository owner (GitHub username/org)
            remote_url: GitHub repository URL
            local_path: Local clone path
            enabled: Whether repository is active
            read_only: Whether repository is read-only
            default_branch: Default branch

        Returns:
            Repository metadata dict
        """
        logger.info(f"Adding repository: {repo_id}")

        repo_metadata = {
            "id": repo_id,
            "name": name,
            "owner": owner,
            "remote_url": remote_url,
            "local_path": str(local_path),
            "enabled": enabled,
            "read_only": read_only,
            "default_branch": default_branch,
            "last_synced": None,
            "sync_status": "never",
            "error_message": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        self.repositories[repo_id] = repo_metadata
        self._save_repositories()

        logger.info(f"Repository {repo_id} added successfully")
        return repo_metadata

    def update_repository(self, repo_id: str, update: dict) -> dict:
        """
        Update repository settings.

        Args:
            repo_id: Repository identifier
            update: Dictionary with updates (enabled, read_only, etc.)

        Returns:
            Updated repository metadata

        Raises:
            ValueError: If repository not found
        """
        if repo_id not in self.repositories:
            raise ValueError(f"Repository {repo_id} not found")

        repo = self.repositories[repo_id]

        # Update allowed fields
        allowed_updates = {"enabled", "read_only", "name"}
        for key, value in update.items():
            if key in allowed_updates:
                repo[key] = value

        self._save_repositories()
        logger.info(f"Repository {repo_id} updated")
        return repo

    def get_repository(self, repo_id: str) -> dict:
        """
        Get repository metadata by ID.

        Args:
            repo_id: Repository identifier

        Returns:
            Repository metadata dict

        Raises:
            ValueError: If repository not found
        """
        if repo_id not in self.repositories:
            raise ValueError(f"Repository {repo_id} not found")

        return self.repositories[repo_id]

    def list_repositories(self) -> List[dict]:
        """
        List all repositories.

        Returns:
            List of repository metadata dicts
        """
        return list(self.repositories.values())

    def remove_repository(self, repo_id: str) -> None:
        """
        Remove a repository from configuration and delete local files.

        Args:
            repo_id: Repository identifier

        Raises:
            ValueError: If repository not found
        """
        if repo_id not in self.repositories:
            raise ValueError(f"Repository {repo_id} not found")

        repo_meta = self.repositories[repo_id]
        local_path = Path(repo_meta["local_path"])

        # Delete local repository directory if it exists
        if local_path.exists():
            try:
                shutil.rmtree(local_path)
                logger.info(f"Deleted local repository directory: {local_path}")
            except Exception as e:
                logger.error(f"Failed to delete local directory {local_path}: {e}")
                # Continue with config removal even if directory deletion fails

        del self.repositories[repo_id]
        self._save_repositories()
        logger.info(f"Repository {repo_id} removed from configuration")

    def sync_repository(
        self,
        repo_id: str,
        author_name: str = "WikiGit",
        author_email: str = "wikigit@example.com",
    ) -> dict:
        """
        Sync a repository with its remote.

        Performs git pull and push operations.

        Args:
            repo_id: Repository identifier
            author_name: Git author name
            author_email: Git author email

        Returns:
            Sync result dict with status and statistics
        """
        if repo_id not in self.repositories:
            raise ValueError(f"Repository {repo_id} not found")

        repo_meta = self.repositories[repo_id]
        local_path = Path(repo_meta["local_path"])

        logger.info(f"Starting sync for repository {repo_id}")

        try:
            # Open the git repository
            repo = Repo(str(local_path))

            # Configure git author
            with repo.config_writer() as config:
                config.set_value("user", "name", author_name)
                config.set_value("user", "email", author_email)

            files_changed = 0

            # Perform pull (fetch + merge)
            commits_pulled = 0
            try:
                origin = repo.remote("origin")
                fetch_info = origin.fetch(repo_meta["default_branch"])
                logger.debug(f"Fetched from remote: {fetch_info}")

                # Get commits to merge
                merge_base = repo.merge_base(
                    "HEAD", f"origin/{repo_meta['default_branch']}"
                )
                if merge_base:
                    commits_to_merge = list(
                        repo.iter_commits(
                            f"{merge_base[0]}..origin/{repo_meta['default_branch']}"
                        )
                    )
                    commits_pulled = len(commits_to_merge)

                # Merge if there are changes
                if commits_pulled > 0:
                    repo.heads[repo_meta["default_branch"]].commit = repo.commit(
                        f"origin/{repo_meta['default_branch']}"
                    )
                    logger.info(f"Merged {commits_pulled} commits from remote")

            except GitCommandError as e:
                logger.warning(f"Pull operation failed for {repo_id}: {e}")

            # Perform push (if not read-only)
            commits_pushed = 0
            if not repo_meta.get("read_only", False):
                try:
                    origin = repo.remote("origin")
                    push_info = origin.push(repo_meta["default_branch"])
                    logger.debug(f"Pushed to remote: {push_info}")

                    # Count pushed commits
                    commits_pushed = sum(
                        1
                        for p in push_info
                        if hasattr(p, "summary") and "commit" in p.summary
                    )
                except GitCommandError as e:
                    logger.warning(f"Push operation failed for {repo_id}: {e}")

            # Update repository sync status
            repo_meta["last_synced"] = datetime.now(timezone.utc).isoformat()
            repo_meta["sync_status"] = "synced"
            repo_meta["error_message"] = None

            self._save_repositories()

            result = {
                "repository_id": repo_id,
                "status": "success",
                "message": "Sync completed successfully",
                "commits_pulled": commits_pulled,
                "commits_pushed": commits_pushed,
                "files_changed": files_changed,
            }

            logger.info(f"Sync completed for {repo_id}: {result}")
            return result

        except Exception as e:
            logger.error(f"Sync failed for repository {repo_id}: {e}")

            # Update error status
            repo_meta["sync_status"] = "error"
            repo_meta["error_message"] = str(e)
            repo_meta["last_synced"] = datetime.now(timezone.utc).isoformat()
            self._save_repositories()

            return {
                "repository_id": repo_id,
                "status": "error",
                "message": f"Sync failed: {str(e)}",
                "commits_pulled": 0,
                "commits_pushed": 0,
                "files_changed": 0,
            }

    def clone_repository(
        self,
        repo_id: str,
        remote_url: str,
        local_path: Path,
        name: str,
        owner: str,
        default_branch: str = "main",
        github_token: Optional[str] = None,
    ) -> dict:
        """
        Clone a repository from remote URL.

        Args:
            repo_id: Repository identifier
            remote_url: GitHub repository URL
            local_path: Local path for clone
            name: Repository display name
            owner: Repository owner
            default_branch: Default branch
            github_token: Optional GitHub PAT for authentication

        Returns:
            Repository metadata dict

        Raises:
            GitCommandError: If clone fails
        """
        logger.info(f"Cloning repository {repo_id} from {remote_url}")

        try:
            # Create parent directory if it doesn't exist
            local_path.parent.mkdir(parents=True, exist_ok=True)

            # Inject GitHub token for private repositories
            clone_url = remote_url
            if github_token and "github.com" in remote_url:
                # Inject token into HTTPS URL
                clone_url = remote_url.replace(
                    "https://github.com", f"https://{github_token}@github.com"
                )
                logger.debug("GitHub token injected into clone URL")

            # Clone repository
            Repo.clone_from(clone_url, str(local_path))
            logger.info(f"Repository {repo_id} cloned successfully")

            # Add to our tracking system
            return self.add_repository(
                repo_id=repo_id,
                name=name,
                owner=owner,
                remote_url=remote_url,
                local_path=local_path,
                default_branch=default_branch,
            )

        except GitCommandError as e:
            logger.error(f"Failed to clone repository {repo_id}: {e}")
            raise

    def get_repository_status(self, repo_id: str) -> dict:
        """
        Get detailed status of a repository.

        Includes sync status and git information.

        Args:
            repo_id: Repository identifier

        Returns:
            Repository status dict

        Raises:
            ValueError: If repository not found
        """
        repo_meta = self.get_repository(repo_id)
        local_path = Path(repo_meta["local_path"])

        status = {
            "id": repo_meta["id"],
            "name": repo_meta["name"],
            "owner": repo_meta["owner"],
            "remote_url": repo_meta["remote_url"],
            "enabled": repo_meta["enabled"],
            "read_only": repo_meta.get("read_only", False),
            "default_branch": repo_meta.get("default_branch", "main"),
            "last_synced": repo_meta.get("last_synced"),
            "sync_status": repo_meta.get("sync_status", "never"),
            "error_message": repo_meta.get("error_message"),
            "has_local_changes": False,
            "ahead_of_remote": 0,
            "behind_of_remote": 0,
        }

        # Get git status if repository exists
        if local_path.exists():
            try:
                repo = Repo(str(local_path))

                # Check for uncommitted changes
                status["has_local_changes"] = repo.is_dirty()

                # Count commits ahead/behind
                try:
                    ahead = list(
                        repo.iter_commits(
                            f"HEAD..origin/{repo_meta.get('default_branch', 'main')}"
                        )
                    )
                    status["behind_of_remote"] = len(ahead)
                except Exception:
                    pass

                try:
                    behind = list(
                        repo.iter_commits(
                            f"origin/{repo_meta.get('default_branch', 'main')}..HEAD"
                        )
                    )
                    status["ahead_of_remote"] = len(behind)
                except Exception:
                    pass

            except Exception as e:
                logger.debug(f"Could not get git status for {repo_id}: {e}")

        return status

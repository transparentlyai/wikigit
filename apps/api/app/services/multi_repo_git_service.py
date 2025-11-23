"""
Multi-repository Git service for WikiGit.

This module provides Git operations for managing multiple repositories:
- Clone repositories with GitHub token authentication
- Sync repositories (pull/push with conflict detection)
- Get repository status (git status info)
- Manage per-repository GitService instances

Repository configuration is loaded from RepositoryService (repositories.json),
not from YAML settings.
"""

import logging
from typing import Dict, Optional, Tuple

from git import Repo
from git.exc import GitCommandError

from app.config.settings import (
    MultiRepositorySettings,
    RepositoryConfig,
    settings,
)
from app.services.git_service import GitService
from app.services import repository_service

logger = logging.getLogger(__name__)


class MultiRepoGitService:
    """Service for managing multiple Git repositories."""

    def __init__(self, multi_repo_settings: Optional[MultiRepositorySettings] = None):
        """
        Initialize multi-repository Git service.

        Args:
            multi_repo_settings: Multi-repository configuration settings (defaults to global settings)
        """
        self.settings = multi_repo_settings or settings.multi_repository
        self.root_dir = self.settings.root_dir

        # Ensure root directory exists
        self.root_dir.mkdir(parents=True, exist_ok=True)

        # Cache of GitService instances per repository
        self._git_services: Dict[str, GitService] = {}

        logger.info(f"Multi-repository service initialized. Root: {self.root_dir}")

    def clone_repository(
        self,
        repo_config: RepositoryConfig,
    ) -> Tuple[bool, Optional[str]]:
        """
        Clone a repository from remote URL to local path.

        Uses GitHub token authentication if available. Creates the
        local directory structure (owner/repo).

        Args:
            repo_config: Repository configuration with remote URL and local path

        Returns:
            Tuple of (success: bool, error_message: Optional[str])
        """
        try:
            local_path = self.root_dir / repo_config.local_path
            remote_url = repo_config.remote_url

            # Check if repository already exists
            if local_path.exists() and (local_path / ".git").exists():
                logger.warning(
                    f"Repository {repo_config.id} already exists at {local_path}"
                )
                return True, None

            # Inject GitHub token into URL for authentication
            auth_url = self._inject_token_into_url(remote_url)

            logger.info(f"Cloning repository {repo_config.id} to {local_path}")

            # Ensure parent directory exists
            local_path.parent.mkdir(parents=True, exist_ok=True)

            # Clone repository
            # Don't log the auth_url as it contains the token
            Repo.clone_from(
                auth_url,
                local_path,
                branch=repo_config.default_branch,
            )

            logger.info(f"Successfully cloned repository {repo_config.id}")
            return True, None

        except GitCommandError as e:
            # Sanitize error message to remove token
            error_msg = self._sanitize_error_message(str(e))
            logger.error(f"Failed to clone repository {repo_config.id}: {error_msg}")
            return False, error_msg

        except Exception as e:
            error_msg = str(e)
            logger.error(
                f"Unexpected error cloning repository {repo_config.id}: {error_msg}"
            )
            return False, error_msg

    def sync_repository(
        self,
        repo_config: RepositoryConfig,
    ) -> Dict[str, any]:
        """
        Sync a repository with its remote (pull/push).

        Implements conflict detection:
        - If local changes + remote changes → error (conflict)
        - If only remote changes → pull
        - If only local changes + writable → push
        - If no changes → up to date

        Args:
            repo_config: Repository configuration

        Returns:
            Dictionary with sync results:
            - status: "success", "error", or "conflict"
            - message: Human-readable message
            - commits_pulled: Number of commits pulled
            - commits_pushed: Number of commits pushed
            - files_changed: Number of files changed
            - error_message: Error details if status is "error"
        """
        try:
            local_path = self.root_dir / repo_config.local_path

            # Check if repository exists locally
            if not local_path.exists() or not (local_path / ".git").exists():
                return {
                    "status": "error",
                    "message": "Repository not cloned locally",
                    "commits_pulled": 0,
                    "commits_pushed": 0,
                    "files_changed": 0,
                    "error_message": "Local repository does not exist. Clone it first.",
                }

            # Open repository
            repo = Repo(local_path)

            # Configure remote with token authentication
            remote_url = self._inject_token_into_url(repo_config.remote_url)
            origin = self._configure_remote(repo, remote_url)

            # Fetch latest from remote
            logger.info(f"Fetching updates for {repo_config.id}")
            origin.fetch()

            # Check for local changes
            has_local_changes = repo.is_dirty() or len(repo.untracked_files) > 0

            # Get current branch
            current_branch = repo.active_branch.name
            if current_branch != repo_config.default_branch:
                logger.warning(
                    f"Repository {repo_config.id} is on branch '{current_branch}', "
                    f"expected '{repo_config.default_branch}'"
                )

            # Get tracking branch
            try:
                tracking_branch = repo.active_branch.tracking_branch()
                if not tracking_branch:
                    return {
                        "status": "error",
                        "message": "No tracking branch configured",
                        "commits_pulled": 0,
                        "commits_pushed": 0,
                        "files_changed": 0,
                        "error_message": "Branch has no remote tracking branch",
                    }
            except Exception as e:
                return {
                    "status": "error",
                    "message": "Failed to get tracking branch",
                    "commits_pulled": 0,
                    "commits_pushed": 0,
                    "files_changed": 0,
                    "error_message": str(e),
                }

            # Check commits ahead/behind
            commits_behind = len(
                list(
                    repo.iter_commits(
                        f"{repo.active_branch.name}..{tracking_branch.name}"
                    )
                )
            )
            commits_ahead = len(
                list(
                    repo.iter_commits(
                        f"{tracking_branch.name}..{repo.active_branch.name}"
                    )
                )
            )

            logger.debug(
                f"Repository {repo_config.id}: "
                f"{commits_ahead} ahead, {commits_behind} behind, "
                f"local changes: {has_local_changes}"
            )

            # Conflict detection: local changes + remote changes
            if has_local_changes and commits_behind > 0:
                return {
                    "status": "conflict",
                    "message": "Conflict detected: local and remote changes present",
                    "commits_pulled": 0,
                    "commits_pushed": 0,
                    "files_changed": 0,
                    "error_message": (
                        "Cannot sync: repository has both local uncommitted changes "
                        "and remote updates. Please resolve manually."
                    ),
                }

            commits_pulled = 0
            commits_pushed = 0
            files_changed = 0

            # Pull if behind
            if commits_behind > 0:
                logger.info(f"Pulling {commits_behind} commits for {repo_config.id}")
                try:
                    pull_info = origin.pull()[0]
                    commits_pulled = commits_behind

                    # Count changed files
                    if pull_info.commit:
                        files_changed = len(pull_info.commit.stats.files)

                    logger.info(
                        f"Successfully pulled {commits_pulled} commits, "
                        f"{files_changed} files changed"
                    )
                except GitCommandError as e:
                    error_msg = self._sanitize_error_message(str(e))
                    return {
                        "status": "error",
                        "message": "Pull failed",
                        "commits_pulled": 0,
                        "commits_pushed": 0,
                        "files_changed": 0,
                        "error_message": error_msg,
                    }

            # Push if ahead and not read-only
            if commits_ahead > 0 and not repo_config.read_only:
                logger.info(f"Pushing {commits_ahead} commits for {repo_config.id}")
                try:
                    origin.push()
                    commits_pushed = commits_ahead
                    logger.info(f"Successfully pushed {commits_pushed} commits")
                except GitCommandError as e:
                    error_msg = self._sanitize_error_message(str(e))
                    return {
                        "status": "error",
                        "message": "Push failed",
                        "commits_pulled": commits_pulled,
                        "commits_pushed": 0,
                        "files_changed": files_changed,
                        "error_message": error_msg,
                    }
            elif commits_ahead > 0 and repo_config.read_only:
                logger.info(
                    f"Repository {repo_config.id} has {commits_ahead} local commits "
                    f"but is read-only, skipping push"
                )

            # Success
            if commits_pulled == 0 and commits_pushed == 0:
                message = "Repository is up to date"
            else:
                message = f"Synced successfully: {commits_pulled} pulled, {commits_pushed} pushed"

            return {
                "status": "success",
                "message": message,
                "commits_pulled": commits_pulled,
                "commits_pushed": commits_pushed,
                "files_changed": files_changed,
                "error_message": None,
            }

        except GitCommandError as e:
            error_msg = self._sanitize_error_message(str(e))
            logger.error(f"Git command failed for {repo_config.id}: {error_msg}")
            return {
                "status": "error",
                "message": "Git operation failed",
                "commits_pulled": 0,
                "commits_pushed": 0,
                "files_changed": 0,
                "error_message": error_msg,
            }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Unexpected error syncing {repo_config.id}: {error_msg}")
            return {
                "status": "error",
                "message": "Sync failed",
                "commits_pulled": 0,
                "commits_pushed": 0,
                "files_changed": 0,
                "error_message": error_msg,
            }

    def get_repository_status(self, repo_config: RepositoryConfig) -> Dict[str, any]:
        """
        Get Git status information for a repository.

        Args:
            repo_config: Repository configuration

        Returns:
            Dictionary with status information:
            - exists: Whether repository exists locally
            - has_local_changes: Whether there are uncommitted changes
            - ahead_of_remote: Number of commits ahead
            - behind_of_remote: Number of commits behind
            - current_branch: Current branch name
            - error: Error message if status check failed
        """
        try:
            local_path = self.root_dir / repo_config.local_path

            # Check if repository exists
            if not local_path.exists() or not (local_path / ".git").exists():
                return {
                    "exists": False,
                    "has_local_changes": False,
                    "ahead_of_remote": 0,
                    "behind_of_remote": 0,
                    "current_branch": None,
                    "error": None,
                }

            # Open repository
            repo = Repo(local_path)

            # Check for local changes
            has_local_changes = repo.is_dirty() or len(repo.untracked_files) > 0

            # Get current branch
            current_branch = repo.active_branch.name

            # Get tracking branch
            tracking_branch = repo.active_branch.tracking_branch()

            if tracking_branch:
                # Count commits ahead/behind
                commits_behind = len(
                    list(
                        repo.iter_commits(
                            f"{repo.active_branch.name}..{tracking_branch.name}"
                        )
                    )
                )
                commits_ahead = len(
                    list(
                        repo.iter_commits(
                            f"{tracking_branch.name}..{repo.active_branch.name}"
                        )
                    )
                )
            else:
                commits_ahead = 0
                commits_behind = 0

            return {
                "exists": True,
                "has_local_changes": has_local_changes,
                "ahead_of_remote": commits_ahead,
                "behind_of_remote": commits_behind,
                "current_branch": current_branch,
                "error": None,
            }

        except Exception as e:
            logger.error(f"Failed to get status for {repo_config.id}: {e}")
            return {
                "exists": False,
                "has_local_changes": False,
                "ahead_of_remote": 0,
                "behind_of_remote": 0,
                "current_branch": None,
                "error": str(e),
            }

    def get_git_service(self, repo_config: RepositoryConfig) -> Optional[GitService]:
        """
        Get or create a GitService instance for a specific repository.

        Args:
            repo_config: Repository configuration

        Returns:
            GitService instance or None if repository doesn't exist locally
        """
        # Check cache
        if repo_config.id in self._git_services:
            return self._git_services[repo_config.id]

        # Check if repository exists locally
        local_path = self.root_dir / repo_config.local_path
        if not local_path.exists() or not (local_path / ".git").exists():
            logger.warning(
                f"Repository {repo_config.id} not found locally at {local_path}"
            )
            return None

        # Create and cache GitService
        git_service = GitService(
            repo_path=local_path,
            author_name=self.settings.author_name,
            author_email=self.settings.author_email,
            remote_url=repo_config.remote_url,
            auto_push=False,  # Controlled by sync operation
        )
        self._git_services[repo_config.id] = git_service

        logger.debug(f"Created GitService for repository {repo_config.id}")
        return git_service

    def get_all_enabled_repositories(self) -> list[RepositoryConfig]:
        """
        Get all enabled repositories from configuration.

        Reads from the RepositoryService (repositories.json) instead of YAML settings
        to get the actual configured repositories.

        Returns:
            List of enabled repository configurations
        """
        # Get repositories from RepositoryService (reads from repositories.json)
        repos_dicts = repository_service.list_repositories()

        # Convert dicts to RepositoryConfig objects and filter for enabled
        enabled_repos = []
        for repo_dict in repos_dicts:
            if repo_dict.get("enabled", False):
                try:
                    # Create RepositoryConfig from dict
                    repo_config = RepositoryConfig(**repo_dict)
                    enabled_repos.append(repo_config)
                except Exception as e:
                    logger.error(
                        f"Failed to parse repository config for {repo_dict.get('id')}: {e}"
                    )
                    continue

        logger.debug(f"Found {len(enabled_repos)} enabled repositories")
        return enabled_repos

    def _inject_token_into_url(self, remote_url: str) -> str:
        """
        Inject GitHub token into HTTPS URL for authentication.

        Args:
            remote_url: Original remote URL

        Returns:
            URL with token injected for authentication
        """
        if not self.settings.github or not self.settings.github.token:
            return remote_url

        token = self.settings.github.token

        # Only inject for HTTPS URLs
        if remote_url.startswith("https://github.com"):
            return remote_url.replace(
                "https://github.com", f"https://{token}@github.com"
            )
        elif remote_url.startswith("https://"):
            return remote_url.replace("https://", f"https://{token}@")

        return remote_url

    def _configure_remote(self, repo: Repo, auth_url: str):
        """
        Configure remote with authentication URL.

        Args:
            repo: Git repository object
            auth_url: Remote URL with authentication token

        Returns:
            Remote object
        """
        if "origin" in repo.remotes:
            origin = repo.remote("origin")
            # Update URL silently (don't log token)
            origin.set_url(auth_url)
        else:
            origin = repo.create_remote("origin", auth_url)

        return origin

    def _sanitize_error_message(self, error_msg: str) -> str:
        """
        Sanitize error message to remove GitHub tokens.

        Args:
            error_msg: Original error message

        Returns:
            Sanitized error message with tokens replaced
        """
        if self.settings.github and self.settings.github.token:
            token = self.settings.github.token
            error_msg = error_msg.replace(token, "***TOKEN***")

        return error_msg

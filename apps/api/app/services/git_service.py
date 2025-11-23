"""
Git service for repository operations using GitPython.

This module provides Git operations for WikiGit including repository
initialization, commits, remote push, and file history retrieval.

Implements SRS requirements:
- REQ-GIT-001: Initialize Git repository
- REQ-GIT-002: Automatic commits
- REQ-GIT-003: Formatted commit messages
- REQ-GIT-004: Optional remote push
- REQ-GIT-005: Configured Git author
- REQ-GIT-006: Graceful push failure handling
- REQ-GIT-007: GitHub token authentication
- REQ-SEC-002: Don't expose credentials in logs
"""

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from git import Repo
from git.exc import GitCommandError

logger = logging.getLogger(__name__)


def format_commit_message(action: str, filename: str, user_email: str) -> str:
    """
    Format commit message per SRS Section 6.6.

    Args:
        action: Action type (Create, Update, Delete, Rename, Config)
        filename: Name of the file being committed
        user_email: Email of the user making the change

    Returns:
        Formatted commit message

    Example:
        >>> format_commit_message("Update", "guides/installation.md", "user@example.com")
        'Update: guides/installation.md\\n\\nAuthor: user@example.com\\nDate: 2025-11-21T10:30:00Z'
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    return f"{action}: {filename}\n\nAuthor: {user_email}\nDate: {timestamp}"


class GitService:
    """
    Git service for repository operations.

    This service manages Git operations for the wiki content repository,
    including initialization, commits, remote push, and history queries.
    """

    def __init__(
        self,
        repo_path: Path,
        author_name: str = "WikiGit Bot",
        author_email: str = "bot@wikigit.app",
        remote_url: Optional[str] = None,
        auto_push: bool = False,
        github_token: Optional[str] = None,
    ):
        """
        Initialize Git service.

        Args:
            repo_path: Path to the Git repository
            author_name: Git commit author name
            author_email: Git commit author email
            remote_url: Optional remote repository URL
            auto_push: Whether to automatically push to remote
            github_token: Optional GitHub token for authentication
        """
        self.repo_path = repo_path
        self.author_name = author_name
        self.author_email = author_email
        self.remote_url = remote_url
        self.auto_push = auto_push
        self.github_token = github_token
        self.repo: Optional[Repo] = None

        # Ensure repository path exists
        self.repo_path.mkdir(parents=True, exist_ok=True)

        # Initialize repository if needed
        self.initialize_repo()

    def initialize_repo(self) -> None:
        """
        Initialize Git repository if it doesn't exist.

        Creates a new Git repository, initial README.md with frontmatter,
        and makes the initial commit if the repository is empty.

        Implements REQ-GIT-001.
        """
        git_dir = self.repo_path / ".git"

        if not git_dir.exists():
            logger.info(f"Initializing new Git repository at {self.repo_path}")
            self.repo = Repo.init(self.repo_path)
            logger.info("Git repository initialized successfully")

            # Configure Git author
            with self.repo.config_writer() as config:
                config.set_value("user", "name", self.author_name)
                config.set_value("user", "email", self.author_email)

            # Create initial README.md with frontmatter if repo is empty
            readme_path = self.repo_path / "README.md"
            if not readme_path.exists():
                logger.info("Creating initial README.md with frontmatter")
                timestamp = datetime.now(timezone.utc).isoformat()
                initial_content = f"""---
title: Welcome to WikiGit
author: {self.author_email}
created_at: {timestamp}
updated_at: {timestamp}
updated_by: {self.author_email}
---

# Welcome to WikiGit

This is your wiki content repository. All articles are stored as Markdown files
with Git version control.

## Getting Started

Create your first article by clicking the "New Article" button in the header.

## Features

- **Git-based storage**: All content is versioned with Git
- **Markdown editing**: Write articles in GitHub Flavored Markdown
- **Full-text search**: Find content across all articles
- **Directory organization**: Organize articles into sections and subsections
"""
                readme_path.write_text(initial_content)
                logger.info("Initial README.md created")

                # Make initial commit
                self.repo.index.add(["README.md"])
                commit_message = format_commit_message(
                    "Create", "README.md", self.author_email
                )
                self.repo.index.commit(commit_message)
                logger.info("Initial commit created")
        else:
            logger.debug(f"Using existing Git repository at {self.repo_path}")
            self.repo = Repo(self.repo_path)

            # Ensure Git author is configured
            with self.repo.config_writer() as config:
                config.set_value("user", "name", self.author_name)
                config.set_value("user", "email", self.author_email)

    def add_and_commit(
        self, file_paths: List[str], action: str, user_email: str
    ) -> str:
        """
        Stage files and create a commit.

        Args:
            file_paths: List of file paths to stage (relative to repo root)
            action: Action type (Create, Update, Delete, etc.)
            user_email: Email of the user making the change

        Returns:
            The commit SHA hash

        Raises:
            RuntimeError: If Git operations fail

        Implements:
        - REQ-GIT-002: Automatic commits
        - REQ-GIT-003: Formatted commit messages
        """
        if not self.repo:
            raise RuntimeError("Git repository not initialized")

        try:
            # Stage the files
            self.repo.index.add(file_paths)
            logger.info(f"Staged {len(file_paths)} file(s) for commit")

            # Create commit message
            if len(file_paths) == 1:
                commit_message = format_commit_message(
                    action, file_paths[0], user_email
                )
            else:
                # Multiple files
                commit_message = f"{action}: {len(file_paths)} files\n\nAuthor: {user_email}\nDate: {datetime.now(timezone.utc).isoformat()}"

            # Create commit
            commit = self.repo.index.commit(commit_message)
            logger.info(f"Created commit {commit.hexsha[:8]} for {action}")

            return commit.hexsha

        except Exception as e:
            logger.error(f"Failed to create commit: {e}")
            raise

    def push_to_remote(self) -> bool:
        """
        Push commits to remote repository if configured.

        Checks if remote is configured and auto-push is enabled before pushing.
        Uses GitHub token for authentication if provided.

        Returns:
            True if push succeeded, False otherwise

        Implements:
        - REQ-GIT-004: Optional remote push
        - REQ-GIT-006: Graceful push failure handling
        - REQ-GIT-007: GitHub token authentication
        """
        if not self.repo:
            logger.error("Cannot push: Git repository not initialized")
            return False

        # Check if remote is configured
        if not self.remote_url:
            logger.debug("No remote repository configured, skipping push")
            return False

        # Check if auto-push is enabled
        if not self.auto_push:
            logger.debug("Auto-push is disabled, skipping push")
            return False

        try:
            # Configure remote if needed
            remote_url = self.remote_url
            if self.github_token and "github.com" in remote_url:
                # Inject token into URL for authentication
                # REQ-SEC-002: Don't expose token in logs
                token = self.github_token
                if remote_url.startswith("https://github.com"):
                    remote_url = remote_url.replace(
                        "https://github.com", f"https://{token}@github.com"
                    )
                elif remote_url.startswith("https://"):
                    # Handle URLs that might already have credentials
                    remote_url = remote_url.replace("https://", f"https://{token}@")

            # Get or create origin remote
            if "origin" in self.repo.remotes:
                origin = self.repo.remote("origin")
                # Update URL if changed (without logging it)
                if origin.url != self.remote_url:
                    origin.set_url(remote_url)
            else:
                origin = self.repo.create_remote("origin", remote_url)

            # Push to remote
            logger.info("Pushing commits to remote repository")
            origin.push()
            logger.info("Successfully pushed to remote repository")
            return True

        except GitCommandError as e:
            # Git command failed (push rejected, network error, etc.)
            error_msg = str(e)
            # Sanitize error message to remove potential tokens
            if self.github_token:
                error_msg = error_msg.replace(self.github_token, "***")
            logger.warning(f"Failed to push to remote repository: {error_msg}")
            return False
        except Exception as e:
            # Catch any other exceptions (network errors, etc.)
            logger.warning(f"Failed to push to remote repository: {e}")
            return False

    def get_file_history(self, file_path: str, max_count: int = 10) -> List[dict]:
        """
        Get commit history for a specific file.

        Args:
            file_path: Path to the file (relative to repo root)
            max_count: Maximum number of commits to return

        Returns:
            List of commit dictionaries with metadata

        Raises:
            RuntimeError: If Git operations fail
        """
        if not self.repo:
            raise RuntimeError("Git repository not initialized")

        try:
            commits = []
            for commit in self.repo.iter_commits(paths=file_path, max_count=max_count):
                commits.append(
                    {
                        "sha": commit.hexsha,
                        "message": commit.message,
                        "author": commit.author.name,
                        "email": commit.author.email,
                        "date": commit.committed_datetime.isoformat(),
                    }
                )
            return commits

        except Exception as e:
            logger.error(f"Failed to get file history: {e}")
            raise RuntimeError(f"Failed to get file history: {e}")

    def get_latest_commit(self, file_path: str) -> Optional[dict]:
        """
        Get the latest commit for a specific file.

        Args:
            file_path: Path to the file (relative to repo root)

        Returns:
            Commit dictionary or None if no commits found
        """
        history = self.get_file_history(file_path, max_count=1)
        return history[0] if history else None

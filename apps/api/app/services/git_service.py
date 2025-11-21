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

from app.config.settings import RepositorySettings

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

    def __init__(self, repo_path: Path, settings: RepositorySettings):
        """
        Initialize Git service.

        Args:
            repo_path: Path to the Git repository
            settings: Repository settings from config
        """
        self.repo_path = repo_path
        self.settings = settings
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
                config.set_value("user", "name", self.settings.author_name)
                config.set_value("user", "email", self.settings.author_email)

            # Create initial README.md with frontmatter if repo is empty
            readme_path = self.repo_path / "README.md"
            if not readme_path.exists():
                logger.info("Creating initial README.md with frontmatter")
                timestamp = datetime.now(timezone.utc).isoformat()
                initial_content = f"""---
title: Welcome to WikiGit
author: {self.settings.author_email}
created_at: {timestamp}
updated_at: {timestamp}
updated_by: {self.settings.author_email}
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
                    "Create",
                    "README.md",
                    self.settings.author_email
                )
                self.repo.index.commit(commit_message)
                logger.info("Initial commit created")
        else:
            logger.debug(f"Using existing Git repository at {self.repo_path}")
            self.repo = Repo(self.repo_path)

            # Ensure Git author is configured
            with self.repo.config_writer() as config:
                config.set_value("user", "name", self.settings.author_name)
                config.set_value("user", "email", self.settings.author_email)

    def add_and_commit(
        self, file_paths: List[str], action: str, user_email: str
    ) -> str:
        """
        Stage files and create a commit.

        Args:
            file_paths: List of file paths relative to repository root
            action: Action type (Create, Update, Delete, Rename, Config)
            user_email: Email of the user making the change

        Returns:
            Commit SHA

        Raises:
            GitCommandError: If Git operation fails

        Implements REQ-GIT-002, REQ-GIT-003, REQ-GIT-005.
        """
        if not self.repo:
            raise RuntimeError("Git repository not initialized")

        # Stage files
        try:
            self.repo.index.add(file_paths)
            logger.debug(f"Staged files: {file_paths}")
        except GitCommandError as e:
            logger.error(f"Failed to stage files: {e}")
            raise

        # Create commit message
        # Use first filename if multiple files
        filename = file_paths[0] if file_paths else "multiple files"
        commit_message = format_commit_message(action, filename, user_email)

        # Create commit
        try:
            commit = self.repo.index.commit(commit_message)
            commit_sha = commit.hexsha
            logger.info(
                f"Created commit {commit_sha[:7]} for {action.lower()}: {filename}"
            )
            return commit_sha
        except GitCommandError as e:
            logger.error(f"Failed to create commit: {e}")
            raise

    def push_to_remote(self) -> bool:
        """
        Push commits to remote repository if configured.

        Checks if remote is configured and auto-push is enabled before pushing.
        Uses GitHub token for authentication if provided.

        Returns:
            True on success, False on failure

        Implements REQ-GIT-004, REQ-GIT-006, REQ-GIT-007.
        """
        if not self.repo:
            logger.error("Cannot push: Git repository not initialized")
            return False

        # Check if remote is configured
        if not self.settings.has_remote:
            logger.debug("No remote repository configured, skipping push")
            return False

        # Check if auto-push is enabled
        if not self.settings.auto_push:
            logger.debug("Auto-push is disabled, skipping push")
            return False

        try:
            # Configure remote if needed
            remote_url = self.settings.remote_url
            if self.settings.has_github_token and "github.com" in remote_url:
                # Inject token into URL for authentication
                # REQ-SEC-002: Don't expose token in logs
                token = self.settings.github_token
                if remote_url.startswith("https://github.com"):
                    remote_url = remote_url.replace(
                        "https://github.com",
                        f"https://{token}@github.com"
                    )
                elif remote_url.startswith("https://"):
                    # Handle URLs that might already have credentials
                    remote_url = remote_url.replace(
                        "https://",
                        f"https://{token}@"
                    )

            # Get or create origin remote
            if "origin" in self.repo.remotes:
                origin = self.repo.remote("origin")
                # Update URL if changed (without logging it)
                if origin.url != self.settings.remote_url:
                    origin.set_url(remote_url)
            else:
                origin = self.repo.create_remote("origin", remote_url)

            # Push to remote
            logger.info("Pushing commits to remote repository")
            origin.push()
            logger.info("Successfully pushed to remote repository")
            return True

        except GitCommandError as e:
            # REQ-GIT-006: Handle push failures gracefully
            # REQ-SEC-002: Don't expose credentials in logs
            error_msg = str(e)
            # Sanitize error message to remove potential tokens
            if self.settings.has_github_token:
                error_msg = error_msg.replace(self.settings.github_token, "***")
            logger.warning(f"Failed to push to remote repository: {error_msg}")
            return False
        except Exception as e:
            # Catch any other exceptions (network errors, etc.)
            logger.warning(f"Failed to push to remote repository: {e}")
            return False

    def get_file_history(
        self, file_path: str, max_count: int = 10
    ) -> List[dict]:
        """
        Get commit history for a specific file.

        Args:
            file_path: Path to file relative to repository root
            max_count: Maximum number of commits to return

        Returns:
            List of commit dictionaries with fields:
            - sha: Commit SHA
            - author: Author name and email
            - date: Commit date (ISO 8601)
            - message: Commit message

        Raises:
            GitCommandError: If Git operation fails
        """
        if not self.repo:
            raise RuntimeError("Git repository not initialized")

        try:
            commits = list(self.repo.iter_commits(paths=file_path, max_count=max_count))
            history = []

            for commit in commits:
                history.append({
                    "sha": commit.hexsha,
                    "author": f"{commit.author.name} <{commit.author.email}>",
                    "date": datetime.fromtimestamp(
                        commit.committed_date, tz=timezone.utc
                    ).isoformat(),
                    "message": commit.message.strip(),
                })

            logger.debug(f"Retrieved {len(history)} commits for {file_path}")
            return history

        except GitCommandError as e:
            logger.error(f"Failed to get file history for {file_path}: {e}")
            raise

    def get_file_content_at_commit(
        self, file_path: str, commit_sha: str
    ) -> Optional[str]:
        """
        Get file content at a specific commit.

        Args:
            file_path: Path to file relative to repository root
            commit_sha: Commit SHA to retrieve content from

        Returns:
            File content as string, or None if file doesn't exist at that commit

        Raises:
            GitCommandError: If Git operation fails
        """
        if not self.repo:
            raise RuntimeError("Git repository not initialized")

        try:
            commit = self.repo.commit(commit_sha)
            try:
                # Get file content from commit
                blob = commit.tree / file_path
                content = blob.data_stream.read().decode("utf-8")
                logger.debug(
                    f"Retrieved content for {file_path} at commit {commit_sha[:7]}"
                )
                return content
            except KeyError:
                # File doesn't exist at this commit
                logger.debug(
                    f"File {file_path} not found at commit {commit_sha[:7]}"
                )
                return None

        except GitCommandError as e:
            logger.error(
                f"Failed to get content for {file_path} at commit {commit_sha}: {e}"
            )
            raise

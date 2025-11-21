"""
Frontmatter service for handling YAML metadata in markdown files.

This service handles parsing, creating, and updating YAML frontmatter
in markdown files according to SRS requirements REQ-ART-011 through REQ-ART-016.

Ref: SRS Section 6.3.2.1 - Article Frontmatter
"""

import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple

import frontmatter
import git

logger = logging.getLogger(__name__)


class FrontmatterService:
    """
    Service for managing YAML frontmatter in markdown files.

    This service provides methods to:
    - Parse frontmatter from existing markdown files
    - Create frontmatter for new articles
    - Update frontmatter while preserving original metadata
    - Migrate legacy markdown files without frontmatter

    All timestamps are stored in ISO 8601 format (UTC).
    """

    def parse_article(self, file_path: Path) -> Tuple[dict, str]:
        """
        Read and parse a markdown file, extracting frontmatter and content.

        Implements REQ-ART-015: Parse frontmatter when reading articles and
        exclude it from the rendered content.

        Args:
            file_path: Path to the markdown file

        Returns:
            Tuple of (metadata dict, content string without frontmatter)
            If file has no frontmatter, returns (empty dict, full content)

        Raises:
            FileNotFoundError: If the file doesn't exist
            IOError: If there's an error reading the file

        Example:
            >>> service = FrontmatterService()
            >>> metadata, content = service.parse_article(Path("article.md"))
            >>> print(metadata['title'])
            'My Article'
            >>> print(content)
            '# My Article\\n\\nContent here...'
        """
        try:
            if not file_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")

            # Use python-frontmatter to parse the file
            post = frontmatter.load(file_path)

            # Extract metadata and content
            metadata = dict(post.metadata) if post.metadata else {}
            content = post.content

            logger.debug(
                f"Parsed article at {file_path}: "
                f"metadata={list(metadata.keys())}, "
                f"content_length={len(content)}"
            )

            return metadata, content

        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Error parsing article at {file_path}: {e}")
            raise IOError(f"Failed to parse article: {e}") from e

    def create_frontmatter(self, title: str, author_email: str, content: str) -> str:
        """
        Create YAML frontmatter for a new article.

        Implements REQ-ART-011 and REQ-ART-012: Add YAML frontmatter to all
        markdown files containing metadata (title, author, timestamps).

        The frontmatter follows the format specified in SRS Section 6.3.2.1:
        ```yaml
        ---
        title: <title>
        author: <author_email>
        created_at: <iso8601-timestamp>
        updated_at: <iso8601-timestamp>
        updated_by: <author_email>
        ---
        ```

        Args:
            title: Article title
            author_email: Email of the article creator
            content: Markdown content (without frontmatter)

        Returns:
            Complete markdown string with frontmatter

        Example:
            >>> service = FrontmatterService()
            >>> markdown = service.create_frontmatter(
            ...     title="Getting Started",
            ...     author_email="user@example.com",
            ...     content="# Getting Started\\n\\nWelcome..."
            ... )
        """
        current_time = self.get_current_timestamp()

        metadata = {
            'title': title,
            'author': author_email,
            'created_at': current_time,
            'updated_at': current_time,
            'updated_by': author_email
        }

        return self.serialize_article(metadata, content)

    def update_frontmatter(
        self,
        file_path: Path,
        updated_by: str,
        content: str
    ) -> str:
        """
        Update frontmatter for an existing article.

        Implements REQ-ART-013 and REQ-ART-014:
        - Automatically update updated_at and updated_by fields
        - Preserve existing frontmatter (title, author, created_at)

        Args:
            file_path: Path to the existing markdown file
            updated_by: Email of the user updating the article
            content: New markdown content (without frontmatter)

        Returns:
            Complete markdown string with updated frontmatter

        Raises:
            FileNotFoundError: If the file doesn't exist

        Example:
            >>> service = FrontmatterService()
            >>> updated = service.update_frontmatter(
            ...     file_path=Path("article.md"),
            ...     updated_by="editor@example.com",
            ...     content="# Updated Content\\n\\nNew content..."
            ... )
        """
        # Parse existing frontmatter
        metadata, _ = self.parse_article(file_path)

        # If no frontmatter exists, we need to create it
        if not metadata:
            # Try to extract title from content or use filename
            title = self.extract_title_from_content(content)
            if not title:
                title = file_path.stem

            # Create new frontmatter with current user as author
            logger.warning(
                f"No frontmatter found in {file_path}, creating new frontmatter"
            )
            return self.create_frontmatter(title, updated_by, content)

        # Update only the mutable fields (REQ-ART-014)
        metadata['updated_at'] = self.get_current_timestamp()
        metadata['updated_by'] = updated_by

        # Preserve immutable fields: title, author, created_at
        # (They remain unchanged from the original metadata)

        return self.serialize_article(metadata, content)

    def add_frontmatter_if_missing(
        self,
        file_path: Path,
        default_author: str
    ) -> None:
        """
        Add frontmatter to a file that doesn't have it (migration helper).

        This is used for migrating legacy markdown files that don't have
        frontmatter. It attempts to extract metadata from Git history
        and file content.

        Args:
            file_path: Path to the markdown file
            default_author: Default author email if Git history unavailable

        Raises:
            FileNotFoundError: If the file doesn't exist
            IOError: If there's an error reading/writing the file

        Example:
            >>> service = FrontmatterService()
            >>> service.add_frontmatter_if_missing(
            ...     file_path=Path("legacy.md"),
            ...     default_author="admin@example.com"
            ... )
        """
        # Check if frontmatter already exists
        metadata, content = self.parse_article(file_path)

        if metadata:
            logger.debug(f"File {file_path} already has frontmatter, skipping")
            return

        logger.info(f"Adding frontmatter to {file_path}")

        # Extract title from content (first H1) or filename
        title = self.extract_title_from_content(content)
        if not title:
            title = file_path.stem.replace('-', ' ').replace('_', ' ').title()

        # Try to get creation date and author from Git history
        author = default_author
        created_at = self.get_current_timestamp()

        try:
            git_metadata = self._get_git_metadata(file_path)
            if git_metadata:
                author = git_metadata.get('author', default_author)
                created_at = git_metadata.get('created_at', created_at)
        except Exception as e:
            logger.warning(
                f"Could not extract Git metadata for {file_path}: {e}"
            )

        # Create frontmatter
        markdown_with_frontmatter = self.create_frontmatter(
            title=title,
            author_email=author,
            content=content
        )

        # Write back to file
        try:
            file_path.write_text(markdown_with_frontmatter, encoding='utf-8')
            logger.info(f"Successfully added frontmatter to {file_path}")
        except Exception as e:
            logger.error(f"Failed to write frontmatter to {file_path}: {e}")
            raise IOError(f"Failed to write frontmatter: {e}") from e

    def serialize_article(self, metadata: dict, content: str) -> str:
        """
        Combine frontmatter metadata and content into a complete markdown string.

        Helper method that uses python-frontmatter to serialize the article
        with proper YAML frontmatter formatting.

        Args:
            metadata: Dictionary of frontmatter fields
            content: Markdown content (without frontmatter)

        Returns:
            Formatted markdown string with frontmatter

        Example:
            >>> service = FrontmatterService()
            >>> markdown = service.serialize_article(
            ...     metadata={'title': 'Test', 'author': 'user@example.com'},
            ...     content='# Test\\n\\nContent'
            ... )
        """
        post = frontmatter.Post(content, **metadata)
        return frontmatter.dumps(post)

    @staticmethod
    def extract_title_from_content(content: str) -> Optional[str]:
        """
        Extract title from markdown content (first H1 heading).

        Searches for the first H1 heading (# Title or underlined) in the
        markdown content and returns it as the title.

        Args:
            content: Markdown content

        Returns:
            Title string if found, None otherwise

        Example:
            >>> FrontmatterService.extract_title_from_content(
            ...     "# My Title\\n\\nContent..."
            ... )
            'My Title'
        """
        if not content:
            return None

        # Try to find ATX-style heading (# Title)
        atx_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if atx_match:
            return atx_match.group(1).strip()

        # Try to find setext-style heading (underlined with =)
        setext_match = re.search(
            r'^(.+)\n=+\s*$',
            content,
            re.MULTILINE
        )
        if setext_match:
            return setext_match.group(1).strip()

        return None

    @staticmethod
    def get_current_timestamp() -> str:
        """
        Get current UTC timestamp in ISO 8601 format.

        Returns:
            ISO 8601 formatted timestamp string (e.g., '2025-11-21T10:00:00Z')

        Example:
            >>> timestamp = FrontmatterService.get_current_timestamp()
            >>> print(timestamp)
            '2025-11-21T15:30:00Z'
        """
        return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    def _get_git_metadata(self, file_path: Path) -> Optional[dict]:
        """
        Extract metadata from Git history for a file.

        Private helper method that attempts to get the original author
        and creation date from the first Git commit that introduced the file.

        Args:
            file_path: Path to the file

        Returns:
            Dict with 'author' and 'created_at' keys, or None if unavailable
        """
        try:
            # Find the Git repository containing this file
            repo = git.Repo(file_path, search_parent_directories=True)

            # Get the first commit that introduced this file
            # We use reverse=True to get oldest first
            commits = list(repo.iter_commits(
                paths=str(file_path),
                max_count=1,
                reverse=True
            ))

            if not commits:
                return None

            first_commit = commits[0]

            # Extract author email and commit date
            author_email = first_commit.author.email
            commit_date = datetime.fromtimestamp(
                first_commit.committed_date,
                tz=timezone.utc
            )
            created_at = commit_date.strftime('%Y-%m-%dT%H:%M:%SZ')

            return {
                'author': author_email,
                'created_at': created_at
            }

        except (git.InvalidGitRepositoryError, git.GitCommandError, Exception) as e:
            logger.debug(f"Could not get Git metadata for {file_path}: {e}")
            return None

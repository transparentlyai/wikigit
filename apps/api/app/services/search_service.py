"""
Full-text search service using Whoosh.

This module provides search functionality for wiki articles using the Whoosh
search engine library. It handles index creation, document indexing, and search queries.
"""

import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from whoosh import index
from whoosh.fields import ID, TEXT, DATETIME, Schema
from whoosh.qparser import MultifieldParser
from whoosh.query import Query

from app.config.settings import SearchSettings
from app.models.schemas import SearchResult
from app.services.frontmatter_service import FrontmatterService

logger = logging.getLogger(__name__)


class SearchService:
    """Service for full-text search using Whoosh."""

    def __init__(self, search_settings: SearchSettings, repo_path: Path):
        """
        Initialize the search service.

        Args:
            search_settings: Search configuration settings
            repo_path: Path to the git repository containing articles
        """
        self.index_dir = search_settings.index_dir
        self.repo_path = repo_path
        self.frontmatter_service = FrontmatterService()

        # Define search schema
        # Updated for multi-repository support with repository_id and repository_name
        self.schema = Schema(
            path=ID(stored=True, unique=True),
            title=TEXT(stored=True),
            content=TEXT(stored=True),
            author=TEXT(stored=True),
            created_at=DATETIME(stored=True),
            updated_at=DATETIME(stored=True),
            updated_by=TEXT(stored=True),
            repository_id=ID(stored=True),
            repository_name=TEXT(stored=True),
        )

        # Create index directory if it doesn't exist
        self.index_dir.mkdir(parents=True, exist_ok=True)

        # Initialize or open index
        if not index.exists_in(str(self.index_dir)):
            logger.info(f"Creating new search index at {self.index_dir}")
            self.ix = index.create_in(str(self.index_dir), self.schema)
        else:
            logger.info(f"Opening existing search index at {self.index_dir}")
            self.ix = index.open_dir(str(self.index_dir))

    @staticmethod
    def _parse_timestamp(timestamp_value) -> Optional[datetime]:
        """
        Parse a timestamp value into a datetime object.

        Handles both datetime objects (from YAML parsing) and ISO 8601 strings.

        Args:
            timestamp_value: datetime object or ISO 8601 formatted string

        Returns:
            datetime object or None if parsing fails or input is None
        """
        if not timestamp_value:
            return None

        # If already a datetime object, return it
        if isinstance(timestamp_value, datetime):
            return timestamp_value

        # Otherwise try to parse as ISO 8601 string
        try:
            return datetime.fromisoformat(str(timestamp_value))
        except (ValueError, AttributeError) as e:
            logger.warning(f"Failed to parse timestamp '{timestamp_value}': {e}")
            return None

    @staticmethod
    def _normalize_author(author_value, default: str = "unknown") -> str:
        """
        Normalize author field to a string.

        Some legacy wiki files have structured author data (dict with id, name, email).
        This method extracts the email or name from such structures.

        Args:
            author_value: Author value (can be string or dict)
            default: Default value if author cannot be determined

        Returns:
            Author as a string
        """
        if not author_value:
            return default

        # If it's a dict (structured author data), extract email or name
        if isinstance(author_value, dict):
            return (
                author_value.get("email")
                or author_value.get("name")
                or str(author_value)
            )

        # Otherwise return as string
        return str(author_value)

    def rebuild_index(self, multi_repo_service) -> int:
        """
        Rebuild the entire search index from scratch.

        Scans all enabled repositories and indexes all markdown files.

        Args:
            multi_repo_service: MultiRepoGitService instance

        Returns:
            int: Number of documents indexed

        Raises:
            Exception: If indexing fails
        """
        try:
            logger.info("Starting full index rebuild")

            # Clear existing index
            writer = self.ix.writer()
            indexed_count = 0

            # Get all enabled repositories
            logger.info("Rebuilding index for all enabled repositories")
            enabled_repos = multi_repo_service.get_all_enabled_repositories()

            for repo_config in enabled_repos:
                local_path = multi_repo_service.root_dir / repo_config.local_path

                # Skip if repository doesn't exist locally
                if not local_path.exists() or not (local_path / ".git").exists():
                    logger.warning(
                        f"Repository {repo_config.id} not found locally, skipping"
                    )
                    continue

                logger.info(f"Indexing repository: {repo_config.id}")
                repo_indexed = self._index_repository(
                    writer,
                    local_path,
                    repository_id=repo_config.id,
                    repository_name=repo_config.name,
                )
                indexed_count += repo_indexed
                logger.info(f"Indexed {repo_indexed} documents from {repo_config.id}")

            # Commit all changes
            writer.commit()
            logger.info(f"Index rebuild complete. Indexed {indexed_count} documents.")

            return indexed_count

        except Exception as e:
            logger.error(f"Failed to rebuild index: {e}")
            raise

    def _index_repository(
        self,
        writer,
        repo_path: Path,
        repository_id: str,
        repository_name: str,
    ) -> int:
        """
        Index all markdown files in a single repository.

        Args:
            writer: Whoosh index writer
            repo_path: Path to the repository
            repository_id: Repository ID (e.g., "owner/repo" or empty for single-repo)
            repository_name: Repository name (e.g., "repo" or empty for single-repo)

        Returns:
            Number of documents indexed from this repository
        """
        indexed_count = 0

        # Find all markdown files
        md_files = list(repo_path.rglob("*.md"))

        for md_file in md_files:
            # Skip hidden files and git directory
            if any(part.startswith(".") for part in md_file.parts):
                continue

            try:
                # Get article path relative to repository root
                article_path = str(md_file.relative_to(repo_path))

                # Use prefixed path for uniqueness in index, but store repo info separately
                if repository_id:
                    indexed_path = f"{repository_id}:{article_path}"
                else:
                    indexed_path = article_path

                # Parse article with frontmatter
                metadata, content = self.frontmatter_service.parse_article(md_file)

                # Extract required fields from metadata (with defaults)
                title = metadata.get("title", md_file.stem)
                author = self._normalize_author(metadata.get("author"))
                created_at = self._parse_timestamp(metadata.get("created_at"))
                updated_at = self._parse_timestamp(metadata.get("updated_at"))
                updated_by = self._normalize_author(
                    metadata.get("updated_by"), default=author
                )

                writer.add_document(
                    path=indexed_path,
                    title=title,
                    content=content,
                    author=author,
                    created_at=created_at,
                    updated_at=updated_at,
                    updated_by=updated_by,
                    repository_id=repository_id,
                    repository_name=repository_name,
                )
                indexed_count += 1

            except Exception as e:
                logger.error(f"Failed to index {md_file}: {e}")
                continue

        return indexed_count

    def index_article(
        self,
        path: str,
        title: str,
        content: str,
        author: str,
        created_at,
        updated_at,
        updated_by: str,
        repository_id: str = "",
        repository_name: str = "",
    ) -> None:
        """
        Index or update a single article in the search index.

        Args:
            path: Article path (unique identifier, may include repository prefix)
            title: Article title
            content: Article content
            author: Original author email
            created_at: Creation timestamp
            updated_at: Last update timestamp
            updated_by: Last updater email
            repository_id: Repository ID (e.g., "owner/repo" or empty for single-repo)
            repository_name: Repository name (e.g., "repo" or empty for single-repo)

        Raises:
            Exception: If indexing fails
        """
        try:
            writer = self.ix.writer()

            # Update or add document (update replaces if path exists)
            writer.update_document(
                path=path,
                title=title,
                content=content,
                author=author,
                created_at=created_at,
                updated_at=updated_at,
                updated_by=updated_by,
                repository_id=repository_id,
                repository_name=repository_name,
            )

            writer.commit()
            logger.info(f"Indexed article: {path}")

        except Exception as e:
            logger.error(f"Failed to index article {path}: {e}")
            raise

    def remove_article(self, path: str) -> None:
        """
        Remove an article from the search index.

        Handles both single-repo and multi-repo path formats:
        - Single-repo: "path/to/file.md"
        - Multi-repo: "owner/repo:path/to/file.md"

        Args:
            path: Article path to remove (may include repository prefix)

        Raises:
            Exception: If removal fails
        """
        try:
            writer = self.ix.writer()
            writer.delete_by_term("path", path)
            writer.commit()
            logger.info(f"Removed article from index: {path}")

        except Exception as e:
            logger.error(f"Failed to remove article {path} from index: {e}")
            raise

    def search(self, query_string: str, limit: int = 20) -> List[SearchResult]:
        """
        Search for articles matching the query.

        Searches in title and content fields with boosted title relevance.

        Args:
            query_string: Search query string
            limit: Maximum number of results to return (default: 20)

        Returns:
            List[SearchResult]: List of search results sorted by relevance

        Raises:
            Exception: If search fails
        """
        try:
            if not query_string or query_string.strip() == "":
                return []

            # Create multifield parser (searches title and content)
            # Boost title field for higher relevance
            parser = MultifieldParser(
                ["title", "content"],
                schema=self.schema,
                fieldboosts={"title": 2.0, "content": 1.0},
            )

            # Parse query
            query: Query = parser.parse(query_string)

            # Execute search
            with self.ix.searcher() as searcher:
                results = searcher.search(query, limit=limit)

                # Convert to SearchResult objects
                search_results = []

                # Get max score for normalization (to 0-1 range)
                max_score = max((hit.score for hit in results), default=1.0)

                for hit in results:
                    # Extract highlighted excerpt from content with more context
                    excerpt = hit.highlights("content", top=3) or ""
                    if not excerpt:
                        # Fall back to first 400 characters if no highlight
                        content = hit["content"] or ""
                        excerpt = content[:400] + ("..." if len(content) > 400 else "")

                    # Normalize score to 0-1 range
                    normalized_score = hit.score / max_score if max_score > 0 else 0.0

                    # Extract repository info (available in multi-repo mode)
                    repository_id = hit.get("repository_id", None) or None
                    repository_name = hit.get("repository_name", None) or None

                    # Extract article path (strip repository prefix if present)
                    full_path = hit["path"]
                    if repository_id and ":" in full_path:
                        # Path format is "repo-id:article/path.md"
                        article_path = full_path.split(":", 1)[1]
                    else:
                        article_path = full_path

                    search_results.append(
                        SearchResult(
                            path=article_path,
                            title=hit["title"],
                            snippet=excerpt,
                            score=normalized_score,
                            repository_id=repository_id,
                            repository_name=repository_name,
                        )
                    )

                logger.info(
                    f"Search query '{query_string}' returned {len(search_results)} results"
                )
                return search_results

        except Exception as e:
            logger.error(f"Search failed for query '{query_string}': {e}")
            raise

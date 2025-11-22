"""
Full-text search service using Whoosh.

This module provides search functionality for wiki articles using the Whoosh
search engine library. It handles index creation, document indexing, and search queries.
"""

import logging
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
        self.schema = Schema(
            path=ID(stored=True, unique=True),
            title=TEXT(stored=True),
            content=TEXT(stored=True),
            author=TEXT(stored=True),
            created_at=DATETIME(stored=True),
            updated_at=DATETIME(stored=True),
            updated_by=TEXT(stored=True),
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

    def rebuild_index(self) -> int:
        """
        Rebuild the entire search index from scratch.

        Scans all markdown files in the repository and indexes them.

        Returns:
            int: Number of documents indexed

        Raises:
            Exception: If indexing fails
        """
        try:
            logger.info("Starting full index rebuild")

            # Clear existing index
            writer = self.ix.writer()

            # Find all markdown files
            md_files = list(self.repo_path.rglob("*.md"))
            indexed_count = 0

            for md_file in md_files:
                # Skip hidden files and git directory
                if any(part.startswith(".") for part in md_file.parts):
                    continue

                try:
                    # Get article path (relative to repo, without .md extension)
                    article_path = str(md_file.relative_to(self.repo_path))[:-3]

                    # Parse article with frontmatter
                    metadata, content = self.frontmatter_service.parse_article(md_file)

                    # Extract required fields from metadata (with defaults)
                    title = metadata.get("title", md_file.stem)
                    author = metadata.get("author", "unknown")
                    created_at = metadata.get("created_at")
                    updated_at = metadata.get("updated_at")
                    updated_by = metadata.get("updated_by", author)

                    # Add to index
                    writer.add_document(
                        path=article_path,
                        title=title,
                        content=content,
                        author=author,
                        created_at=created_at,
                        updated_at=updated_at,
                        updated_by=updated_by,
                    )
                    indexed_count += 1
                    logger.debug(f"Indexed: {article_path}")

                except Exception as e:
                    logger.error(f"Failed to index {md_file}: {e}")
                    continue

            # Commit all changes
            writer.commit()
            logger.info(f"Index rebuild complete. Indexed {indexed_count} documents.")

            return indexed_count

        except Exception as e:
            logger.error(f"Failed to rebuild index: {e}")
            raise

    def index_article(
        self,
        path: str,
        title: str,
        content: str,
        author: str,
        created_at,
        updated_at,
        updated_by: str,
    ) -> None:
        """
        Index or update a single article in the search index.

        Args:
            path: Article path (unique identifier)
            title: Article title
            content: Article content
            author: Original author email
            created_at: Creation timestamp
            updated_at: Last update timestamp
            updated_by: Last updater email

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
            )

            writer.commit()
            logger.info(f"Indexed article: {path}")

        except Exception as e:
            logger.error(f"Failed to index article {path}: {e}")
            raise

    def remove_article(self, path: str) -> None:
        """
        Remove an article from the search index.

        Args:
            path: Article path to remove

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
                for hit in results:
                    # Extract highlighted excerpt from content
                    excerpt = hit.highlights("content", top=1) or ""
                    if not excerpt:
                        # Fall back to first 200 characters if no highlight
                        content = hit["content"] or ""
                        excerpt = content[:200] + ("..." if len(content) > 200 else "")

                    search_results.append(
                        SearchResult(
                            path=hit["path"],
                            title=hit["title"],
                            snippet=excerpt,
                            score=hit.score,
                        )
                    )

                logger.info(
                    f"Search query '{query_string}' returned {len(search_results)} results"
                )
                return search_results

        except Exception as e:
            logger.error(f"Search failed for query '{query_string}': {e}")
            raise

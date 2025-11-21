"""
Search endpoints for WikiGit API.

This module provides endpoints for full-text search functionality.
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.config.settings import settings
from app.middleware.auth import get_current_user, require_admin
from app.models.schemas import SearchResult, IndexStats
from app.services.search_service import SearchService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/search", tags=["search"])


def get_search_service():
    """Dependency to get SearchService instance."""
    return SearchService(settings.search, settings.repository.repo_path)


@router.get("", response_model=List[SearchResult])
async def search_articles(
    q: str = Query(..., description="Search query string", min_length=1),
    limit: int = Query(20, description="Maximum number of results", ge=1, le=100),
    _user: str = Depends(get_current_user),
    search_service: SearchService = Depends(get_search_service)
):
    """
    Search for articles matching the query.

    Performs full-text search across article titles and content.
    Results are ranked by relevance with title matches boosted.

    Args:
        q: Search query string (required)
        limit: Maximum number of results to return (1-100, default: 20)

    Returns:
        List[SearchResult]: List of matching articles with excerpts and scores

    Raises:
        HTTPException: If search fails
    """
    try:
        results = search_service.search(q, limit=limit)
        logger.info(f"Search query '{q}' returned {len(results)} results")
        return results

    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.post("/reindex", response_model=IndexStats, status_code=status.HTTP_200_OK)
async def reindex_all(
    _user: str = Depends(require_admin),
    search_service: SearchService = Depends(get_search_service)
):
    """
    Rebuild the entire search index.

    Scans all markdown files in the repository and rebuilds the search index
    from scratch. This operation may take some time for large wikis.

    Requires admin privileges.

    Returns:
        IndexStats: Statistics about the reindexing operation

    Raises:
        HTTPException: If reindexing fails
    """
    try:
        logger.info("Starting search index rebuild")
        document_count = search_service.rebuild_index()

        return IndexStats(
            status="completed",
            document_count=document_count,
            message=f"Successfully indexed {document_count} articles"
        )

    except Exception as e:
        logger.error(f"Failed to rebuild search index: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to rebuild search index: {str(e)}"
        )

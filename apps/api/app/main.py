"""
WikiGit FastAPI Application.

Main application entry point for the WikiGit backend API.
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.middleware.auth import AuthMiddleware
from app.routers import articles, config, directories, health, search
from app.services.git_service import GitService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.

    Handles startup and shutdown events for the FastAPI application.
    """
    # Startup
    logger.info("Starting WikiGit API...")

    # Initialize Git repository
    try:
        repo_path = settings.repository.repo_path
        git_service = GitService(repo_path, settings.repository)
        git_service.initialize_repo()
        logger.info(f"Git repository initialized at {repo_path}")
    except Exception as e:
        logger.error(f"Failed to initialize Git repository: {e}")
        raise

    # Create data directories
    settings.search.index_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Search index directory: {settings.search.index_dir}")

    logger.info("WikiGit API started successfully")

    yield

    # Shutdown
    logger.info("Shutting down WikiGit API...")


# Create FastAPI application
app = FastAPI(
    title="WikiGit API",
    description="Git-based wiki application backend",
    version="0.1.0",
    lifespan=lifespan,
)

# Add CORS middleware
# Allow frontend origin from environment variable or default to port 3003
frontend_port = os.getenv("FRONTEND_PORT", "3003")
allowed_origins = [
    f"http://localhost:{frontend_port}",
    "http://localhost:3003",  # Keep default for backwards compatibility
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add authentication middleware
app.add_middleware(AuthMiddleware)

# Include routers
app.include_router(health.router)
app.include_router(articles.router)
app.include_router(directories.router)
app.include_router(search.router)
app.include_router(config.router)


@app.get("/")
async def root():
    """Root endpoint - redirects to API documentation."""
    return {
        "message": "WikiGit API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

/**
 * WikiGit API Client
 *
 * Complete API client for all WikiGit backend endpoints.
 * Uses fetch API with proper error handling and typed responses.
 */

import type {
  Article,
  ArticleCreate,
  ArticleUpdate,
  ArticleListResponse,
  DirectoryTreeResponse,
  DirectoryCreate,
  SearchResult,
  SearchResponse,
  IndexStats,
  ConfigData,
  ConfigResponse,
  ConfigUpdate,
  ErrorResponse,
  MediaFile,
  MediaListResponse,
  GitHubRepository,
  RepositoryStatus,
  RepositoryListResponse,
  RepositorySyncResponse,
} from '@/types/api';

// ============================================================================
// Configuration
// ============================================================================

// Use relative URLs to leverage Next.js rewrites to proxy to the backend
// The rewrites are configured in next.config.js based on BACKEND_PORT
const API_BASE_URL = '';

// ============================================================================
// Error Handling
// ============================================================================

export class ApiError extends Error {
  status: number;
  errors?: ErrorResponse;

  constructor(message: string, status: number, errors?: ErrorResponse) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ErrorResponse | undefined;
    try {
      errorData = await response.json();
    } catch {
      // If JSON parsing fails, use status text
      errorData = {
        detail: response.statusText || 'An error occurred',
      };
    }

    throw new ApiError(
      errorData?.detail || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorData
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  try {
    return await response.json();
  } catch (error) {
    throw new ApiError('Failed to parse response JSON', response.status);
  }
}

// ============================================================================
// HTTP Methods
// ============================================================================

async function get<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  return handleResponse<T>(response);
}

async function post<T>(endpoint: string, data?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: data ? JSON.stringify(data) : undefined,
  });

  return handleResponse<T>(response);
}

async function put<T>(endpoint: string, data?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: data ? JSON.stringify(data) : undefined,
  });

  return handleResponse<T>(response);
}

async function del<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  return handleResponse<T>(response);
}

// ============================================================================
// Article Endpoints
// ============================================================================

/**
 * Get all articles (list view with summaries)
 * GET /api/articles or GET /api/repositories/{repositoryId}/articles
 *
 * @param repositoryId - Optional repository ID to get articles for a specific repository
 */
export async function getArticles(repositoryId?: string): Promise<ArticleListResponse> {
  if (repositoryId) {
    return get<ArticleListResponse>(`/api/repositories/${encodeURIComponent(repositoryId)}/articles`);
  }
  return get<ArticleListResponse>('/api/articles');
}

/**
 * Get a specific article by path
 * GET /api/articles/{path} or GET /api/repositories/{repositoryId}/articles/{path}
 *
 * @param pathOrRepoId - Article path or repository ID (when using multi-repo)
 * @param path - Article path (when repository ID is provided)
 */
export async function getArticle(pathOrRepoId: string, path?: string): Promise<Article> {
  if (path) {
    // Multi-repo mode: repositoryId and path provided
    const encodedPath = encodeURIComponent(path);
    return get<Article>(`/api/repositories/${encodeURIComponent(pathOrRepoId)}/articles/${encodedPath}`);
  }
  // Single-repo mode: just path provided
  const encodedPath = encodeURIComponent(pathOrRepoId);
  return get<Article>(`/api/articles/${encodedPath}`);
}

/**
 * Create a new article
 * POST /api/articles or POST /api/repositories/{repositoryId}/articles
 *
 * @param dataOrRepoId - Article creation data or repository ID (when using multi-repo)
 * @param data - Article creation data (when repository ID is provided)
 */
export async function createArticle(dataOrRepoId: ArticleCreate | string, data?: ArticleCreate): Promise<Article> {
  if (typeof dataOrRepoId === 'string' && data) {
    // Multi-repo mode: repositoryId and data provided
    return post<Article>(`/api/repositories/${encodeURIComponent(dataOrRepoId)}/articles`, data);
  }
  // Single-repo mode: just data provided
  return post<Article>('/api/articles', dataOrRepoId as ArticleCreate);
}

/**
 * Update an existing article
 * PUT /api/articles/{path} or PUT /api/repositories/{repositoryId}/articles/{path}
 *
 * @param pathOrRepoId - Article path or repository ID (when using multi-repo)
 * @param dataOrPath - Article update data or article path (when repository ID is provided)
 * @param data - Article update data (when repository ID is provided)
 */
export async function updateArticle(
  pathOrRepoId: string,
  dataOrPath: ArticleUpdate | string,
  data?: ArticleUpdate
): Promise<Article> {
  if (typeof dataOrPath === 'string' && data) {
    // Multi-repo mode: repositoryId, path, and data provided
    const encodedPath = encodeURIComponent(dataOrPath);
    return put<Article>(`/api/repositories/${encodeURIComponent(pathOrRepoId)}/articles/${encodedPath}`, data);
  }
  // Single-repo mode: path and data provided
  const encodedPath = encodeURIComponent(pathOrRepoId);
  return put<Article>(`/api/articles/${encodedPath}`, dataOrPath as ArticleUpdate);
}

/**
 * Delete an article
 * DELETE /api/articles/{path} or DELETE /api/repositories/{repositoryId}/articles/{path}
 *
 * @param pathOrRepoId - Article path or repository ID (when using multi-repo)
 * @param path - Article path (when repository ID is provided)
 */
export async function deleteArticle(pathOrRepoId: string, path?: string): Promise<void> {
  if (path) {
    // Multi-repo mode: repositoryId and path provided
    const encodedPath = encodeURIComponent(path);
    return del<void>(`/api/repositories/${encodeURIComponent(pathOrRepoId)}/articles/${encodedPath}`);
  }
  // Single-repo mode: just path provided
  const encodedPath = encodeURIComponent(pathOrRepoId);
  return del<void>(`/api/articles/${encodedPath}`);
}

/**
 * Move or rename an article
 * POST /api/articles/{path}/move or POST /api/repositories/{repositoryId}/articles/{path}/move
 *
 * @param pathOrRepoId - Current article path or repository ID (when using multi-repo)
 * @param newPathOrPath - New article path or current path (when repository ID is provided)
 * @param newPath - New article path (when repository ID is provided)
 */
export async function moveArticle(pathOrRepoId: string, newPathOrPath: string, newPath?: string): Promise<Article> {
  if (newPath) {
    // Multi-repo mode: repositoryId, path, and newPath provided
    const encodedPath = encodeURIComponent(newPathOrPath);
    return post<Article>(`/api/repositories/${encodeURIComponent(pathOrRepoId)}/articles/${encodedPath}/move`, { new_path: newPath });
  }
  // Single-repo mode: path and newPath provided
  const encodedPath = encodeURIComponent(pathOrRepoId);
  return post<Article>(`/api/articles/${encodedPath}/move`, { new_path: newPathOrPath });
}

// ============================================================================
// Directory Endpoints
// ============================================================================

/**
 * Get complete directory tree
 * GET /api/directories or GET /api/repositories/{repositoryId}/directories
 *
 * @param repositoryId - Optional repository ID to get directories for a specific repository
 */
export async function getDirectories(repositoryId?: string): Promise<DirectoryTreeResponse> {
  if (repositoryId) {
    return get<DirectoryTreeResponse>(`/api/repositories/${encodeURIComponent(repositoryId)}/directories`);
  }
  return get<DirectoryTreeResponse>('/api/directories');
}

/**
 * Create a new directory
 * POST /api/directories or POST /api/repositories/{repositoryId}/directories
 *
 * @param pathOrRepoId - Directory path or repository ID (when using multi-repo)
 * @param path - Directory path (when repository ID is provided)
 */
export async function createDirectory(pathOrRepoId: string, path?: string): Promise<void> {
  if (path) {
    // Multi-repo mode: repositoryId and path provided
    const data: DirectoryCreate = { path };
    return post<void>(`/api/repositories/${encodeURIComponent(pathOrRepoId)}/directories`, data);
  }
  // Single-repo mode: just path provided
  const data: DirectoryCreate = { path: pathOrRepoId };
  return post<void>('/api/directories', data);
}

/**
 * Delete a directory
 * DELETE /api/directories/{path} or DELETE /api/repositories/{repositoryId}/directories/{path}
 *
 * @param pathOrRepoId - Directory path or repository ID (when using multi-repo)
 * @param path - Directory path (when repository ID is provided)
 */
export async function deleteDirectory(pathOrRepoId: string, path?: string): Promise<void> {
  if (path) {
    // Multi-repo mode: repositoryId and path provided
    const encodedPath = encodeURIComponent(path);
    return del<void>(`/api/repositories/${encodeURIComponent(pathOrRepoId)}/directories/${encodedPath}`);
  }
  // Single-repo mode: just path provided
  const encodedPath = encodeURIComponent(pathOrRepoId);
  return del<void>(`/api/directories/${encodedPath}`);
}

/**
 * Move or rename a directory
 * POST /api/directories/{path}/move or POST /api/repositories/{repositoryId}/directories/{path}/move
 *
 * @param pathOrRepoId - Current directory path or repository ID (when using multi-repo)
 * @param newPathOrPath - New directory path or current path (when repository ID is provided)
 * @param newPath - New directory path (when repository ID is provided)
 */
export async function moveDirectory(pathOrRepoId: string, newPathOrPath: string, newPath?: string): Promise<void> {
  if (newPath) {
    // Multi-repo mode: repositoryId, path, and newPath provided
    const encodedPath = encodeURIComponent(newPathOrPath);
    return post<void>(`/api/repositories/${encodeURIComponent(pathOrRepoId)}/directories/${encodedPath}/move`, { new_path: newPath });
  }
  // Single-repo mode: path and newPath provided
  const encodedPath = encodeURIComponent(pathOrRepoId);
  return post<void>(`/api/directories/${encodedPath}/move`, { new_path: newPathOrPath });
}

// ============================================================================
// Search Endpoints
// ============================================================================

/**
 * Search articles by query
 * GET /api/search?q={query}
 *
 * @param query - Search query string
 */
export async function search(query: string): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  return get<SearchResult[]>(`/api/search?q=${encodedQuery}`);
}

/**
 * Rebuild the entire search index
 * POST /api/search/reindex
 *
 * Requires admin privileges.
 */
export async function reindexSearch(): Promise<IndexStats> {
  return post<IndexStats>('/api/search/reindex');
}

// ============================================================================
// Configuration Endpoints
// ============================================================================

/**
 * Get current application configuration
 * GET /api/config
 */
export async function getConfig(): Promise<ConfigData> {
  return get<ConfigData>('/api/config');
}

/**
 * Update application configuration
 * PUT /api/config
 *
 * @param data - Configuration updates (partial updates supported)
 */
export async function updateConfig(data: ConfigUpdate): Promise<ConfigData> {
  return put<ConfigData>('/api/config', data);
}

// ============================================================================
// Repository Endpoints
// ============================================================================

/**
 * Scan GitHub user's accessible repositories
 * GET /api/repositories/scan
 *
 * Requires GitHub token in config to list user's repositories.
 * Returns list of accessible GitHub repositories.
 */
export async function scanGitHubRepositories(): Promise<GitHubRepository[]> {
  return get<GitHubRepository[]>('/api/repositories/scan');
}

/**
 * List all configured repositories
 * GET /api/repositories
 *
 * Returns all repositories configured in the system with their sync status.
 */
export async function listRepositories(): Promise<RepositoryListResponse> {
  return get<RepositoryListResponse>('/api/repositories');
}

/**
 * Get a specific repository by ID
 * GET /api/repositories/{repositoryId}
 *
 * @param repositoryId - Repository identifier
 */
export async function getRepository(repositoryId: string): Promise<RepositoryStatus> {
  return get<RepositoryStatus>(`/api/repositories/${encodeURIComponent(repositoryId)}`);
}

/**
 * Add/clone repositories from GitHub
 * POST /api/repositories
 *
 * @param repoIds - Array of repository IDs to add
 */
export async function addRepositories(repoIds: string[]): Promise<void> {
  return post<void>('/api/repositories', { repository_ids: repoIds });
}

/**
 * Update repository settings
 * PUT /api/repositories/{repositoryId}
 *
 * @param repositoryId - Repository identifier
 * @param update - Update object with optional enabled and read_only flags
 */
export async function updateRepository(
  repositoryId: string,
  update: {
    enabled?: boolean;
    read_only?: boolean;
  }
): Promise<RepositoryStatus> {
  return put<RepositoryStatus>(
    `/api/repositories/${encodeURIComponent(repositoryId)}`,
    update
  );
}

/**
 * Sync a repository with its remote
 * POST /api/repositories/{repositoryId}/sync
 *
 * Performs a git pull/push sync with the remote repository.
 *
 * @param repositoryId - Repository identifier
 */
export async function syncRepository(repositoryId: string): Promise<RepositorySyncResponse> {
  return post<RepositorySyncResponse>(
    `/api/repositories/${encodeURIComponent(repositoryId)}/sync`
  );
}

/**
 * Remove a repository
 * DELETE /api/repositories/{repositoryId}
 *
 * Removes a repository from the system but does not delete local files.
 *
 * @param repositoryId - Repository identifier
 */
export async function removeRepository(repositoryId: string): Promise<void> {
  return del<void>(`/api/repositories/${encodeURIComponent(repositoryId)}`);
}

// ============================================================================
// GitHub Settings Endpoints
// ============================================================================

/**
 * Get current GitHub settings
 * GET /api/repositories/github/settings
 */
export async function getGitHubSettings(): Promise<{ user_id: string; token_env_var: string }> {
  return get<{ user_id: string; token_env_var: string }>('/api/repositories/github/settings');
}

/**
 * Test GitHub connection
 * POST /api/repositories/github/test
 *
 * @param settings - GitHub user ID and token variable name
 */
export async function testGitHubConnection(settings: { user_id: string; token_var: string }): Promise<{ status: string; message: string }> {
  return post<{ status: string; message: string }>('/api/repositories/github/test', settings);
}

/**
 * Save GitHub settings
 * POST /api/repositories/github/settings
 *
 * @param settings - GitHub user ID and token variable name
 */
export async function saveGitHubSettings(settings: { user_id: string; token_var: string }): Promise<void> {
  return post<void>('/api/repositories/github/settings', settings);
}

// ============================================================================
// Media Endpoints
// ============================================================================

/**
 * Upload a media file
 * POST /api/media
 *
 * @param file - File to upload
 */
export async function uploadMedia(file: File): Promise<MediaFile> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/media`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  return handleResponse<MediaFile>(response);
}

/**
 * Get all media files
 * GET /api/media
 */
export async function getMediaFiles(): Promise<MediaListResponse> {
  return get<MediaListResponse>('/api/media');
}

/**
 * Delete a media file
 * DELETE /api/media/{filename}
 *
 * @param filename - Name of the file to delete
 */
export async function deleteMediaFile(filename: string): Promise<void> {
  const encodedFilename = encodeURIComponent(filename);
  return del<void>(`/api/media/${encodedFilename}`);
}

/**
 * Get media file URL
 *
 * @param filename - Name of the file
 */
export function getMediaUrl(filename: string): string {
  return `/media/${encodeURIComponent(filename)}`;
}

// ============================================================================
// Export all API functions
// ============================================================================

export const api = {
  // Articles
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  moveArticle,

  // Directories
  getDirectories,
  createDirectory,
  deleteDirectory,
  moveDirectory,

  // Search
  search,
  reindexSearch,

  // Configuration
  getConfig,
  updateConfig,

  // Repositories
  scanGitHubRepositories,
  listRepositories,
  getRepository,
  addRepositories,
  updateRepository,
  syncRepository,
  removeRepository,
  getGitHubSettings,
  testGitHubConnection,
  saveGitHubSettings,

  // Media
  uploadMedia,
  getMediaFiles,
  deleteMediaFile,
  getMediaUrl,
};

export default api;

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
 * GET /api/articles
 */
export async function getArticles(): Promise<ArticleListResponse> {
  return get<ArticleListResponse>('/api/articles');
}

/**
 * Get a specific article by path
 * GET /api/articles/{path}
 *
 * @param path - Article path (e.g., "README.md" or "guides/install.md")
 */
export async function getArticle(path: string): Promise<Article> {
  // Encode path to handle special characters and slashes
  const encodedPath = encodeURIComponent(path);
  return get<Article>(`/api/articles/${encodedPath}`);
}

/**
 * Create a new article
 * POST /api/articles
 *
 * @param data - Article creation data (path, content, optional title)
 */
export async function createArticle(data: ArticleCreate): Promise<Article> {
  return post<Article>('/api/articles', data);
}

/**
 * Update an existing article
 * PUT /api/articles/{path}
 *
 * @param path - Article path to update
 * @param data - Updated article content
 */
export async function updateArticle(
  path: string,
  data: ArticleUpdate
): Promise<Article> {
  const encodedPath = encodeURIComponent(path);
  return put<Article>(`/api/articles/${encodedPath}`, data);
}

/**
 * Delete an article
 * DELETE /api/articles/{path}
 *
 * @param path - Article path to delete
 */
export async function deleteArticle(path: string): Promise<void> {
  const encodedPath = encodeURIComponent(path);
  return del<void>(`/api/articles/${encodedPath}`);
}

// ============================================================================
// Directory Endpoints
// ============================================================================

/**
 * Get complete directory tree
 * GET /api/directories
 */
export async function getDirectories(): Promise<DirectoryTreeResponse> {
  return get<DirectoryTreeResponse>('/api/directories');
}

/**
 * Create a new directory
 * POST /api/directories
 *
 * @param path - Directory path to create
 */
export async function createDirectory(path: string): Promise<void> {
  const data: DirectoryCreate = { path };
  return post<void>('/api/directories', data);
}

/**
 * Delete a directory
 * DELETE /api/directories/{path}
 *
 * @param path - Directory path to delete
 */
export async function deleteDirectory(path: string): Promise<void> {
  const encodedPath = encodeURIComponent(path);
  return del<void>(`/api/directories/${encodedPath}`);
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

  // Directories
  getDirectories,
  createDirectory,
  deleteDirectory,

  // Search
  search,
  reindexSearch,

  // Configuration
  getConfig,
  updateConfig,

  // Media
  uploadMedia,
  getMediaFiles,
  deleteMediaFile,
  getMediaUrl,
};

export default api;

/**
 * TypeScript interfaces matching WikiGit backend API schemas.
 *
 * Based on Pydantic models from backend/app/models/schemas.py
 */

// ============================================================================
// Article Types
// ============================================================================

export interface Article {
  path: string;
  title: string;
  content: string;
  author: string | null;
  created_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface ArticleCreate {
  path: string;
  content: string;
  title?: string;
}

export interface ArticleUpdate {
  content: string;
}

export interface ArticleSummary {
  path: string;
  title: string;
  author: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface ArticleListResponse {
  articles: ArticleSummary[];
}

// ============================================================================
// Directory Types
// ============================================================================

export interface DirectoryNode {
  type: 'directory' | 'file';
  name: string;
  path: string;
  children?: DirectoryNode[];
}

export interface Directory {
  path: string;
  name: string;
  children: DirectoryNode[];
}

export interface DirectoryCreate {
  path: string;
}

export interface DirectoryTreeResponse {
  tree: DirectoryNode[];
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
}

export interface IndexStats {
  status: string;
  document_count: number;
  message: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AppConfig {
  name?: string;
  description?: string;
  domain?: string;
  max_file_size_mb?: number;
}

export interface RepositoryConfig {
  path?: string;
  remote_url?: string;
  auto_push?: boolean;
  github_token?: string;
  author_name?: string;
  author_email?: string;
}

export interface SearchConfig {
  index_path?: string;
  rebuild_on_startup?: boolean;
}

export interface ConfigData {
  app_name: string;
  admins: string[];
  repo_path: string;
  default_branch: string;
  auto_push: boolean;
  remote_url?: string;
  github_token?: string;
  index_dir: string;
}

export interface ConfigUpdate {
  app?: {
    name?: string;
    admins?: string[];
  };
  repository?: {
    auto_push?: boolean;
    remote_url?: string;
    github_token?: string;
  };
  search?: {
    index_dir?: string;
  };
}

export interface ConfigResponse {
  app: AppConfig;
  admin_users: string[];
  repository: RepositoryConfig;
  search: SearchConfig;
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  version: string;
  timestamp: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface ErrorDetail {
  field?: string;
  message: string;
  type?: string;
}

export interface ErrorResponse {
  detail: string;
  errors?: ErrorDetail[];
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
  email: string;
  is_admin: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: ErrorResponse;
}

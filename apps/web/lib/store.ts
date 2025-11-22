/**
 * WikiGit Zustand Store
 *
 * Global state management for the WikiGit application.
 * Manages articles, directories, search results, user, and UI state.
 */

import { create } from 'zustand';
import type {
  Article,
  ArticleSummary,
  DirectoryNode,
  SearchResult,
  User,
  ConfigData,
} from '@/types/api';

// ============================================================================
// Store State Interface
// ============================================================================

interface WikiGitStore {
  // Article State
  articles: ArticleSummary[];
  currentArticle: Article | null;
  setArticles: (articles: ArticleSummary[]) => void;
  setCurrentArticle: (article: Article | null) => void;

  // Directory State
  directories: DirectoryNode[];
  setDirectories: (directories: DirectoryNode[]) => void;

  // Search State
  searchResults: SearchResult[];
  searchQuery: string;
  setSearchResults: (results: SearchResult[]) => void;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;

  // User State
  user: User | null;
  setUser: (user: User | null) => void;

  // Config State
  appName: string;
  setAppName: (name: string) => void;

  // UI State
  isLoading: boolean;
  error: string | null;
  isSidebarOpen: boolean;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  toggleSidebar: () => void;

  // Reset Actions
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  // Article State
  articles: [],
  currentArticle: null,

  // Directory State
  directories: [],

  // Search State
  searchResults: [],
  searchQuery: '',

  // User State
  user: null,

  // Config State
  appName: 'Wikigit',

  // UI State
  isLoading: false,
  error: null,
  isSidebarOpen: true,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const useWikiStore = create<WikiGitStore>((set) => ({
  ...initialState,

  // Article Actions
  setArticles: (articles) => set({ articles }),
  setCurrentArticle: (article) => set({ currentArticle: article }),

  // Directory Actions
  setDirectories: (directories) => set({ directories }),

  // Search Actions
  setSearchResults: (results) => set({ searchResults: results }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearSearch: () => set({ searchResults: [], searchQuery: '' }),

  // User Actions
  setUser: (user) => set({ user }),

  // Config Actions
  setAppName: (name) => set({ appName: name }),

  // UI Actions
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  // Reset Actions
  reset: () => set(initialState),
}));

// ============================================================================
// Selector Hooks (for better performance and convenience)
// ============================================================================

/**
 * Get articles from store
 */
export const useArticles = () => useWikiStore((state) => state.articles);

/**
 * Get current article from store
 */
export const useCurrentArticle = () => useWikiStore((state) => state.currentArticle);

/**
 * Get directories from store
 */
export const useDirectories = () => useWikiStore((state) => state.directories);

/**
 * Get search state from store
 */
export const useSearch = () =>
  useWikiStore((state) => ({
    results: state.searchResults,
    query: state.searchQuery,
  }));

/**
 * Get user from store
 */
export const useUser = () => useWikiStore((state) => state.user);

/**
 * Get loading state from store
 */
export const useIsLoading = () => useWikiStore((state) => state.isLoading);

/**
 * Get error state from store
 */
export const useError = () => useWikiStore((state) => state.error);

/**
 * Get sidebar state from store
 */
export const useSidebar = () => useWikiStore((state) => state.isSidebarOpen);

/**
 * Get all actions from store
 */
export const useWikiActions = () =>
  useWikiStore((state) => ({
    setArticles: state.setArticles,
    setCurrentArticle: state.setCurrentArticle,
    setDirectories: state.setDirectories,
    setSearchResults: state.setSearchResults,
    setSearchQuery: state.setSearchQuery,
    clearSearch: state.clearSearch,
    setUser: state.setUser,
    setLoading: state.setLoading,
    setError: state.setError,
    clearError: state.clearError,
    toggleSidebar: state.toggleSidebar,
    reset: state.reset,
  }));

// ============================================================================
// Export
// ============================================================================

// Export as default and alias for convenience
export default useWikiStore;
export { useWikiStore as useStore };

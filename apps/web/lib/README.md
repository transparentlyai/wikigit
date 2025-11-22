# WikiGit API Client & Store

This directory contains the API client and state management for WikiGit.

## Files

- **api.ts** - Complete API client with all backend endpoints
- **store.ts** - Zustand store for global state management

## Usage Examples

### API Client

```typescript
import { api } from '@/lib/api';
import { getArticle, createArticle } from '@/lib/api';

// Get all articles
const articles = await api.getArticles();

// Get a specific article
const article = await api.getArticle('README.md');

// Create a new article
const newArticle = await api.createArticle({
  path: 'guides/tutorial.md',
  content: '# Tutorial\n\nContent here...',
  title: 'Tutorial Guide'
});

// Update an article
const updated = await api.updateArticle('guides/tutorial.md', {
  content: '# Updated Tutorial\n\nNew content...'
});

// Delete an article
await api.deleteArticle('guides/tutorial.md');

// Search
const results = await api.search('installation guide');

// Get directories
const tree = await api.getDirectories();

// Get/Update config
const config = await api.getConfig();
await api.updateConfig({ app: { name: 'My Wiki' } });
```

### Error Handling

```typescript
import { api, ApiError } from '@/lib/api';

try {
  const article = await api.getArticle('nonexistent.md');
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.message);
    console.error('Status:', error.status);
    console.error('Details:', error.errors);
  }
}
```

### Zustand Store

```typescript
import { useWikiStore, useArticles, useWikiActions } from '@/lib/store';

// Use the full store
function MyComponent() {
  const { articles, isLoading, error } = useWikiStore();

  return <div>...</div>;
}

// Use selector hooks (better performance)
function ArticleList() {
  const articles = useArticles();
  const { setArticles, setLoading } = useWikiActions();

  useEffect(() => {
    const loadArticles = async () => {
      setLoading(true);
      try {
        const data = await api.getArticles();
        setArticles(data.articles);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadArticles();
  }, []);

  return (
    <ul>
      {articles.map(article => (
        <li key={article.path}>{article.title}</li>
      ))}
    </ul>
  );
}

// Use individual selectors
function SearchBar() {
  const { results, query } = useSearch();
  const { setSearchQuery, setSearchResults } = useWikiActions();

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    const data = await api.search(q);
    setSearchResults(data.results);
  };

  return <input onChange={(e) => handleSearch(e.target.value)} />;
}
```

### Store State

The store manages:

- **articles**: List of article summaries
- **currentArticle**: Currently viewed article with full content
- **directories**: Directory tree structure
- **searchResults**: Search results array
- **searchQuery**: Current search query
- **user**: Current user information
- **isLoading**: Global loading state
- **error**: Global error message
- **isSidebarOpen**: Sidebar visibility state

### Store Actions

Available actions:

- `setArticles(articles)` - Set article list
- `setCurrentArticle(article)` - Set current article
- `setDirectories(tree)` - Set directory tree
- `setSearchResults(results)` - Set search results
- `setSearchQuery(query)` - Set search query
- `clearSearch()` - Clear search state
- `setUser(user)` - Set current user
- `setLoading(isLoading)` - Set loading state
- `setError(error)` - Set error message
- `clearError()` - Clear error
- `toggleSidebar()` - Toggle sidebar visibility
- `reset()` - Reset all state to initial values

## Environment Variables

Create a `.env.local` file:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## TypeScript Types

All TypeScript types are defined in `/types/api.ts` and match the backend Pydantic schemas exactly.

Import types:

```typescript
import type { Article, ArticleCreate, SearchResult } from '@/types/api';
```

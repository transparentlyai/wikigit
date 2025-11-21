'use client';

/**
 * Header component for WikiGit
 * Contains logo, search input, and action buttons
 */

import Link from 'next/link';
import { Search, Plus, Settings, Home } from 'lucide-react';
import { useWikiStore } from '@/lib/store';

export function Header() {
  const { searchQuery, setSearchQuery, user } = useWikiStore();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to search page with query
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <header className="wiki-header">
      <Link href="/" className="wiki-logo">
        WikiGit
      </Link>

      <div className="search-container">
        <form onSubmit={handleSearchSubmit}>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                opacity: 0.5,
              }}
            />
            <input
              type="text"
              className="search-input"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={handleSearchChange}
              style={{ paddingLeft: '32px' }}
            />
          </div>
        </form>
      </div>

      <div className="wiki-header-actions">
        <Link href="/" className="btn">
          <Home size={16} style={{ marginRight: '4px' }} />
          Home
        </Link>

        <Link href="/new" className="btn btn-primary">
          <Plus size={16} style={{ marginRight: '4px' }} />
          New Article
        </Link>

        {user?.is_admin && (
          <Link href="/admin" className="btn">
            <Settings size={16} style={{ marginRight: '4px' }} />
            Admin
          </Link>
        )}
      </div>
    </header>
  );
}

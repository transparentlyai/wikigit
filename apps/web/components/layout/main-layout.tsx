'use client';

/**
 * Main layout wrapper component for WikiGit
 * Combines Header, Sidebar, and main content area
 * Fetches directory tree on mount
 */

import { useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { useWikiStore } from '@/lib/store';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { directories, setDirectories, setLoading, setError } = useWikiStore();

  useEffect(() => {
    // Fetch directories on mount
    const fetchDirectories = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/directories');

        if (!response.ok) {
          throw new Error(`Failed to fetch directories: ${response.statusText}`);
        }

        const data = await response.json();
        setDirectories(data || []);
      } catch (error) {
        console.error('Error fetching directories:', error);
        setError(error instanceof Error ? error.message : 'Failed to load directories');
      } finally {
        setLoading(false);
      }
    };

    fetchDirectories();
  }, [setDirectories, setLoading, setError]);

  return (
    <>
      <Header />
      <div className="wiki-main">
        <Sidebar directories={directories} />
        <div className="wiki-content">{children}</div>
      </div>
    </>
  );
}

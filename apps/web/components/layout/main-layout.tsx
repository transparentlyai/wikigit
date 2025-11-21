'use client';

/**
 * Main layout wrapper component for WikiGit
 * Combines Header, Sidebar, and main content area
 * Fetches directory tree on mount
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { useWikiStore } from '@/lib/store';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 500;
const DEFAULT_SIDEBAR_WIDTH = 220;

export function MainLayout({ children }: MainLayoutProps) {
  const { directories, setDirectories, setLoading, setError } = useWikiStore();
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
      setSidebarWidth(parseInt(savedWidth, 10));
    }
  }, []);

  useEffect(() => {
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

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && sidebarRef.current) {
      const newWidth = e.clientX;
      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(newWidth);
        localStorage.setItem('sidebarWidth', newWidth.toString());
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <>
      <Header />
      <div className="wiki-main">
        <div
          ref={sidebarRef}
          className="wiki-sidebar"
          style={{ width: `${sidebarWidth}px` }}
        >
          <Sidebar directories={directories} />
        </div>
        <div
          className="sidebar-resize-handle"
          onMouseDown={startResizing}
          style={{
            cursor: 'col-resize',
            width: '5px',
            backgroundColor: isResizing ? 'var(--color-border)' : 'transparent',
            transition: isResizing ? 'none' : 'background-color 0.2s',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '3px',
              height: '40px',
              backgroundColor: 'var(--color-border-subtle)',
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          />
        </div>
        <div className="wiki-content">{children}</div>
      </div>
    </>
  );
}

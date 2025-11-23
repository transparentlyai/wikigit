'use client';

/**
 * Main layout wrapper component for WikiGit
 * Flat design with collapsible sidebar and resize functionality
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { useWikiStore } from '@/lib/store';
import type { RepositoryStatus } from '@/types/api';

interface MainLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  onEdit?: () => void;
  showEditButton?: boolean;
  isReadOnly?: boolean;
  repository?: RepositoryStatus | null;
}

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 500;
const DEFAULT_SIDEBAR_WIDTH = 288;

export function MainLayout({ children, breadcrumbs, onEdit, showEditButton, isReadOnly = false, repository = null }: MainLayoutProps) {
  const { directories, setDirectories, setLoading, setError } = useWikiStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
      setSidebarWidth(parseInt(savedWidth, 10));
    }

    const savedOpen = localStorage.getItem('sidebarOpen');
    if (savedOpen !== null) {
      setSidebarOpen(savedOpen === 'true');
    }
  }, []);

  // In multi-repository mode, directories are fetched per-repository in the sidebar
  // No need to fetch a global directory tree
  useEffect(() => {
    setLoading(false);
    setDirectories([]);
  }, [setDirectories, setLoading]);

  const toggleSidebar = useCallback(() => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem('sidebarOpen', newState.toString());
  }, [sidebarOpen]);

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && sidebarRef.current) {
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - sidebarRect.left;
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
    <div className="flex h-screen overflow-hidden bg-gray-200 justify-center">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 z-20"
          onClick={toggleSidebar}
        />
      )}

      {/* Centered layout container */}
      <div className="flex overflow-hidden">
        {/* Sidebar - Full height on left */}
        <aside
          ref={sidebarRef}
          className={`
            fixed md:relative z-30 h-screen bg-gray-50 border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:overflow-hidden'}
          `}
          style={{ width: sidebarOpen ? `${sidebarWidth}px` : '0' }}
        >
          <Sidebar directories={directories} onRefresh={fetchDirectories} />
        </aside>

        {/* Resize Handle - only visible when sidebar is open */}
        {sidebarOpen && (
          <div
            className="hidden md:flex items-center justify-center cursor-col-resize transition-colors"
            onMouseDown={startResizing}
            style={{
              width: '5px',
              backgroundColor: isResizing ? '#e5e7eb' : 'transparent',
              flexShrink: 0,
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                (e.target as HTMLElement).style.backgroundColor = '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                (e.target as HTMLElement).style.backgroundColor = 'transparent';
              }
            }}
          >
            <div
              className="absolute w-[3px] h-10 bg-gray-300 rounded pointer-events-none"
              style={{
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>
        )}

        {/* Content area - fixed width */}
        <div className="flex flex-col overflow-hidden" style={{ width: '896px', minWidth: '896px', maxWidth: '896px' }}>
          <Header
            sidebarOpen={sidebarOpen}
            onToggleSidebar={toggleSidebar}
            breadcrumbs={breadcrumbs}
            onEdit={onEdit}
            showEditButton={showEditButton}
            isReadOnly={isReadOnly}
            repository={repository}
          />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto bg-white">
            <div className="px-12 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

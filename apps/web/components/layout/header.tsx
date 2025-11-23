"use client";

/**
 * Header component for WikiGit
 * Matches design spec exactly from WikiUIDesing.js
 */

import { Menu, X, ChevronRight, Edit2, MoreHorizontal, Lock } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import type { RepositoryStatus } from "@/types/api";

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  breadcrumbs?: { label: string; href?: string }[];
  onEdit?: () => void;
  showEditButton?: boolean;
  isReadOnly?: boolean;
  repository?: RepositoryStatus | null;
}

export function Header({
  sidebarOpen,
  onToggleSidebar,
  breadcrumbs = [],
  onEdit,
  showEditButton = false,
  isReadOnly = false,
  repository = null
}: HeaderProps) {
  return (
    <header className="h-14 border-b border-gray-100 flex items-center justify-between px-4 md:px-8 shrink-0 bg-white">
      {/* Left Section - Toggle and Breadcrumbs */}
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Mobile Toggle */}
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors md:hidden"
          aria-label="Toggle Sidebar"
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* Desktop Toggle */}
        <div className="hidden md:block">
          <button
            onClick={onToggleSidebar}
            className="mr-3 text-gray-400 hover:text-gray-600 transition-colors"
            title="Toggle Sidebar"
            aria-label="Toggle Sidebar"
          >
            {sidebarOpen ? <Menu size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* Breadcrumbs */}
        <Breadcrumbs items={breadcrumbs} />
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-3">
        {showEditButton && isReadOnly ? (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-400">
            <Lock size={14} />
            <span>Read-only repository</span>
          </div>
        ) : showEditButton && onEdit ? (
          <button
            onClick={onEdit}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-md border border-transparent hover:border-gray-200 transition-all"
          >
            <Edit2 size={14} />
            <span>Edit</span>
          </button>
        ) : null}
        <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
          <MoreHorizontal size={18} />
        </button>
      </div>
    </header>
  );
}

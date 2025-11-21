'use client';

/**
 * Sidebar component with recursive file tree navigation
 * Flat design with gray-50 background and blue active states
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { DirectoryNode } from '@/types/api';

interface SidebarProps {
  directories: DirectoryNode[];
}

interface TreeNodeProps {
  node: DirectoryNode;
  level: number;
}

const EXPANDED_NODES_KEY = 'wikigit-expanded-nodes';

function getExpandedNodes(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  const stored = localStorage.getItem(EXPANDED_NODES_KEY);
  return stored ? new Set(JSON.parse(stored)) : new Set();
}

function saveExpandedNodes(nodes: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(EXPANDED_NODES_KEY, JSON.stringify(Array.from(nodes)));
}

function TreeNode({ node, level }: TreeNodeProps) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);

  const isDirectory = node.type === 'directory';
  const hasChildren = isDirectory && node.children && node.children.length > 0;

  const isActive = pathname === `/article/${node.path}`;

  useEffect(() => {
    const expandedNodes = getExpandedNodes();
    setIsExpanded(expandedNodes.has(node.path));
  }, [node.path]);

  const handleToggle = (e: React.MouseEvent) => {
    if (isDirectory) {
      e.preventDefault();
      const newExpandedState = !isExpanded;
      setIsExpanded(newExpandedState);

      const expandedNodes = getExpandedNodes();
      if (newExpandedState) {
        expandedNodes.add(node.path);
      } else {
        expandedNodes.delete(node.path);
      }
      saveExpandedNodes(expandedNodes);
    }
  };

  const paddingLeft = `${level * 12 + 12}px`;

  const renderContent = () => {
    const chevron = isDirectory && hasChildren && (
      <span className={`opacity-50 ${isActive ? 'text-blue-500' : ''}`}>
        {isExpanded ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
      </span>
    );

    const icon = !isDirectory && (
      <span className={`opacity-50 ${isActive ? 'text-blue-500' : ''}`}>
        <FileText size={14} />
      </span>
    );

    const content = (
      <>
        {chevron}
        {icon}
        <span className="truncate">{node.name}</span>
      </>
    );

    const className = `
      group flex items-center gap-2 px-3 py-1.5 mx-2 rounded-md cursor-pointer text-sm transition-colors select-none
      ${
        isActive
          ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }
    `;

    if (isDirectory) {
      return (
        <div
          className={className}
          onClick={handleToggle}
          style={{ paddingLeft }}
        >
          {content}
        </div>
      );
    }

    return (
      <Link
        href={`/article/${node.path}`}
        className={className}
        style={{ paddingLeft }}
      >
        {content}
      </Link>
    );
  };

  return (
    <div>
      {renderContent()}

      {isDirectory && hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode key={`${child.type}:${child.path}`} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ directories }: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="h-14 flex items-center px-4 border-b border-gray-200/50 shrink-0">
        <div className="flex items-center gap-2 font-bold text-gray-800 tracking-tight">
          <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center text-white">
            <span className="text-xs">Wg</span>
          </div>
          <span>Wikigit</span>
        </div>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative group">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
          />
          <input
            type="text"
            placeholder="Search docs..."
            className="w-full bg-white border border-gray-200 rounded-md py-1.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-400"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-mono">
              ⌘K
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tree */}
      <nav className="flex-1 overflow-y-auto py-2">
        <div className="px-4 mb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          Workspace
        </div>
        {directories.length === 0 ? (
          <p className="text-gray-400 text-sm px-4">No articles yet</p>
        ) : (
          <div>
            {directories.map((node) => (
              <TreeNode key={`${node.type}:${node.path}`} node={node} level={0} />
            ))}
          </div>
        )}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-gray-200/50 text-xs text-gray-500 flex justify-between items-center">
        <span>v2.4.0</span>
        <button className="hover:text-gray-800 transition-colors">
          Settings
        </button>
      </div>
    </div>
  );
}

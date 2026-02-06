'use client';

/**
 * Directory listing component for displaying directory contents
 * Shows folders first, then files, each as navigable links
 */

import Link from 'next/link';
import { Folder, FileText } from 'lucide-react';
import type { DirectoryNode } from '@/types/api';

interface DirectoryListingProps {
  directoryName: string;
  contents: DirectoryNode[];
  repositoryId?: string;
  currentPath: string;
}

export function DirectoryListing({ directoryName, contents, repositoryId, currentPath }: DirectoryListingProps) {
  // Sort: directories first, then files, alphabetically within each group
  const sorted = [...contents].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  const buildHref = (node: DirectoryNode) => {
    return repositoryId ? `/${repositoryId}/${node.path}` : `/${node.path}`;
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-gray-900 tracking-tighter mb-6 mt-2 pb-4 border-b border-gray-100">
        {directoryName}
      </h1>

      {sorted.length === 0 ? (
        <p className="text-gray-500">This directory is empty.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {sorted.map((node) => (
            <li key={`${node.type}:${node.path}`}>
              <Link
                href={buildHref(node)}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-md transition-colors text-gray-700 hover:text-gray-900"
              >
                {node.type === 'directory' ? (
                  <Folder size={18} className="text-gray-400 shrink-0" />
                ) : (
                  <FileText size={18} className="text-gray-400 shrink-0" />
                )}
                <span className="text-sm">{node.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

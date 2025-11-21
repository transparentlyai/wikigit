'use client';

/**
 * Sidebar component with recursive file tree navigation
 * Displays directory structure and allows navigation to articles
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Folder, FileText, ChevronRight, ChevronDown, FolderPlus } from 'lucide-react';
import { DirectoryNode } from '@/types/api';

interface SidebarProps {
  directories: DirectoryNode[];
}

interface TreeNodeProps {
  node: DirectoryNode;
  level: number;
}

function TreeNode({ node, level }: TreeNodeProps) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);

  const isDirectory = node.type === 'directory';
  const hasChildren = isDirectory && node.children && node.children.length > 0;

  // Determine if this node is the currently active article
  const isActive = pathname === `/article/${node.path}`;

  const handleToggle = (e: React.MouseEvent) => {
    if (isDirectory) {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
  };

  const renderContent = () => {
    const icon = isDirectory ? (
      <Folder className="nav-tree-icon" size={16} />
    ) : (
      <FileText className="nav-tree-icon" size={16} />
    );

    const chevron = isDirectory && hasChildren && (
      <span
        style={{
          marginRight: '4px',
          display: 'inline-flex',
          transition: 'transform 0.2s',
        }}
      >
        {isExpanded ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
      </span>
    );

    const content = (
      <>
        {chevron}
        {icon}
        {node.name}
      </>
    );

    if (isDirectory) {
      return (
        <div
          className="nav-tree-link"
          onClick={handleToggle}
          style={{ cursor: 'pointer' }}
        >
          {content}
        </div>
      );
    }

    return (
      <Link
        href={`/article/${node.path}`}
        className={`nav-tree-link ${isActive ? 'active' : ''}`}
      >
        {content}
      </Link>
    );
  };

  return (
    <li className="nav-tree-item">
      {renderContent()}

      {isDirectory && hasChildren && isExpanded && (
        <ul className="nav-tree-nested">
          {node.children!.map((child) => (
            <TreeNode key={`${child.type}:${child.path}`} node={child} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({ directories }: SidebarProps) {
  const handleNewFolder = () => {
    window.location.href = '/new-folder';
  };

  return (
    <>
      <div className="wiki-sidebar-title">Navigation</div>

      {directories.length === 0 ? (
        <p className="text-muted text-sm">No articles yet</p>
      ) : (
        <ul className="nav-tree">
          {directories.map((node) => (
            <TreeNode key={`${node.type}:${node.path}`} node={node} level={0} />
          ))}
        </ul>
      )}

      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border-subtle)' }}>
        <button
          className="btn"
          onClick={handleNewFolder}
          style={{ width: '100%', justifyContent: 'flex-start' }}
        >
          <FolderPlus size={16} style={{ marginRight: '4px' }} />
          New Folder
        </button>
      </div>
    </>
  );
}

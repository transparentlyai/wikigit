'use client';

/**
 * Sidebar component with recursive file tree navigation
 * Flat design with gray-50 background and blue active states
 */

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, ChevronRight, ChevronDown, Search, FilePlus, FolderPlus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DirectoryNode, RepositoryStatus } from '@/types/api';
import { useWikiStore } from '@/lib/store';
import { api } from '@/lib/api';
import { RepositoryNode } from './repository-node';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { InputDialog } from '@/components/ui/input-dialog';

interface SidebarProps {
  directories: DirectoryNode[];
  onRefresh?: () => void;
}

interface TreeNodeProps {
  node: DirectoryNode;
  level: number;
  onRefresh?: () => void;
  repositoryId?: string;
  isReadOnly?: boolean;
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

function TreeNode({ node, level, onRefresh, repositoryId, isReadOnly = false }: TreeNodeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Dialog states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showNewArticleDialog, setShowNewArticleDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);

  // Auto-expand timer
  const expandTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isDirectory = node.type === 'directory';
  const hasChildren = isDirectory && node.children && node.children.length > 0;

  // Construct article path with repository ID if in multi-repo mode
  const articleUrl = repositoryId ? `/${repositoryId}/${node.path}` : `/${node.path}`;
  const isActive = pathname === articleUrl;

  useEffect(() => {
    const expandedNodes = getExpandedNodes();
    setIsExpanded(expandedNodes.has(node.path));
  }, [node.path]);

  // Cleanup expand timer on unmount
  useEffect(() => {
    return () => {
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current);
      }
    };
  }, []);

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

  const handleNewArticle = async (name: string) => {
    try {
      // Automatically add .md extension if not present
      const articleName = name.endsWith('.md') ? name : `${name}.md`;

      const basePath = isDirectory ? node.path : node.path.split('/').slice(0, -1).join('/');
      const newPath = basePath ? `${basePath}/${articleName}` : articleName;

      if (repositoryId) {
        await api.createArticle(repositoryId, {
          path: newPath,
          content: `# ${articleName.replace('.md', '')}\n\nStart writing your article here...`,
        });
      } else {
        await api.createArticle({
          path: newPath,
          content: `# ${articleName.replace('.md', '')}\n\nStart writing your article here...`,
        });
      }

      toast.success(`Article "${articleName}" created`);
      setShowNewArticleDialog(false);
      onRefresh?.();
      const articlePath = repositoryId ? `${repositoryId}/${newPath}` : newPath;
      router.push(`/${articlePath}?edit=true`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create article');
    }
  };

  const handleNewFolder = async (name: string) => {
    try {
      const basePath = isDirectory ? node.path : node.path.split('/').slice(0, -1).join('/');
      const newPath = basePath ? `${basePath}/${name}` : name;

      if (repositoryId) {
        await api.createDirectory(repositoryId, newPath);
      } else {
        await api.createDirectory(newPath);
      }
      toast.success(`Folder "${name}" created`);
      setShowNewFolderDialog(false);
      onRefresh?.();

      if (isDirectory) {
        setIsExpanded(true);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create folder');
    }
  };

  const handleRename = async (newName: string) => {
    try {
      // Validate new name
      if (!newName || newName.trim() === '') {
        toast.error('Name cannot be empty');
        return;
      }

      // Don't rename if name hasn't changed
      if (newName === node.name) {
        setShowRenameDialog(false);
        return;
      }

      // Calculate new path
      const pathParts = node.path.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');

      if (isDirectory) {
        if (repositoryId) {
          await api.moveDirectory(repositoryId, node.path, newPath);
        } else {
          await api.moveDirectory(node.path, newPath);
        }
        toast.success(`Folder renamed to "${newName}"`);
      } else {
        // For articles, the newName might not have .md extension
        // The API will handle adding it if needed
        if (repositoryId) {
          await api.moveArticle(repositoryId, node.path, newPath);
        } else {
          await api.moveArticle(node.path, newPath);
        }
        toast.success(`Article renamed to "${newName}"`);

        // If renaming the current article, navigate to new location
        if (isActive) {
          const articlePath = repositoryId ? `${repositoryId}/${newPath}` : newPath;
          router.push(`/${articlePath}`);
        }
      }

      setShowRenameDialog(false);
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to rename');
    }
  };

  const handleDelete = async () => {
    try {
      if (isDirectory) {
        if (repositoryId) {
          await api.deleteDirectory(repositoryId, node.path);
        } else {
          await api.deleteDirectory(node.path);
        }
        toast.success(`Folder "${node.name}" deleted`);
      } else {
        if (repositoryId) {
          await api.deleteArticle(repositoryId, node.path);
        } else {
          await api.deleteArticle(node.path);
        }
        toast.success(`Article "${node.name}" deleted`);

        if (isActive) {
          router.push('/');
        }
      }

      setShowDeleteConfirm(false);
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({
      path: node.path,
      type: node.type,
      name: node.name,
      repositoryId: repositoryId || null,
    }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    // Only allow drop on directories
    if (isDirectory) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);

      // Auto-expand collapsed directory after hovering for 600ms
      if (!isExpanded && hasChildren && !expandTimerRef.current) {
        expandTimerRef.current = setTimeout(() => {
          setIsExpanded(true);
          const expandedNodes = getExpandedNodes();
          expandedNodes.add(node.path);
          saveExpandedNodes(expandedNodes);
          expandTimerRef.current = null;
        }, 600);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    setIsDragOver(false);

    // Clear auto-expand timer when leaving
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Only allow drop on directories
    if (!isDirectory) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const sourcePath = data.path;
      const sourceType = data.type;
      const sourceName = data.name;
      const sourceRepositoryId = data.repositoryId;

      // Validate same repository
      if (sourceRepositoryId !== (repositoryId || null)) {
        toast.error('Cannot move files between repositories');
        return;
      }

      // Don't allow dropping on self
      if (sourcePath === node.path) return;

      // Don't allow dropping a directory into its own child
      if (sourceType === 'directory' && node.path.startsWith(sourcePath + '/')) {
        toast.error('Cannot move a directory into itself');
        return;
      }

      // Calculate new path
      const newPath = `${node.path}/${sourceName}`;

      // Move the item
      if (sourceType === 'directory') {
        if (repositoryId) {
          await api.moveDirectory(repositoryId, sourcePath, newPath);
        } else {
          await api.moveDirectory(sourcePath, newPath);
        }
        toast.success(`Moved folder to ${node.name}`);
      } else {
        if (repositoryId) {
          await api.moveArticle(repositoryId, sourcePath, newPath);
        } else {
          await api.moveArticle(sourcePath, newPath);
        }
        toast.success(`Moved article to ${node.name}`);
      }

      // Refresh the tree
      onRefresh?.();

      // If it was the current article, navigate to new location
      const sourceArticleUrl = repositoryId ? `/${repositoryId}/${sourcePath}` : `/${sourcePath}`;
      if (sourceType === 'file' && pathname === sourceArticleUrl) {
        const newArticleUrl = repositoryId ? `/${repositoryId}/${newPath}` : `/${newPath}`;
        router.push(newArticleUrl);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to move item');
    }
  };

  const paddingLeft = `${level * 12 + 12}px`;

  // Display name without .md extension for files
  const displayName = isDirectory ? node.name : node.name.replace(/\.md$/, '');

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
        <span className="truncate">{displayName}</span>
      </>
    );

    const className = `
      group flex items-center gap-2 px-3 py-1.5 mx-2 rounded-md cursor-pointer text-sm transition-colors select-none
      ${
        isActive
          ? 'bg-blue-50 text-blue-700 font-medium'
          : isContextMenuOpen
          ? 'bg-gray-100 text-gray-900'
          : isDragOver
          ? 'bg-blue-100 border-2 border-blue-500 border-dashed'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }
    `;

    if (isDirectory) {
      return (
        <div
          className={className}
          onClick={handleToggle}
          style={{ paddingLeft }}
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {content}
        </div>
      );
    }

    return (
      <Link
        href={articleUrl}
        className={className}
        style={{ paddingLeft }}
        draggable
        onDragStart={handleDragStart}
      >
        {content}
      </Link>
    );
  };

  return (
    <>
      <ContextMenu onOpenChange={setIsContextMenuOpen}>
        <ContextMenuTrigger asChild>
          <div>{renderContent()}</div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          {isDirectory ? (
            <>
              <ContextMenuItem
                onClick={() => setShowNewArticleDialog(true)}
                disabled={isReadOnly}
              >
                <FilePlus className="mr-2 h-4 w-4" />
                New Article
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => setShowNewFolderDialog(true)}
                disabled={isReadOnly}
              >
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => setShowRenameDialog(true)}
                disabled={isReadOnly}
              >
                <Edit className="mr-2 h-4 w-4" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 focus:text-red-600"
                disabled={isReadOnly}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </ContextMenuItem>
              {isReadOnly && (
                <>
                  <ContextMenuSeparator />
                  <div className="px-2 py-1.5 text-xs text-gray-500">
                    This repository is read-only
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <ContextMenuItem
                onClick={() => setShowRenameDialog(true)}
                disabled={isReadOnly}
              >
                <Edit className="mr-2 h-4 w-4" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 focus:text-red-600"
                disabled={isReadOnly}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </ContextMenuItem>
              {isReadOnly && (
                <>
                  <ContextMenuSeparator />
                  <div className="px-2 py-1.5 text-xs text-gray-500">
                    This repository is read-only
                  </div>
                </>
              )}
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {isDirectory && hasChildren && isExpanded && (
        <div>
          {node.children!.map((child, index) => (
            <TreeNode
              key={`${child.type}:${child.path}:${index}`}
              node={child}
              level={level + 1}
              onRefresh={onRefresh}
              repositoryId={repositoryId}
              isReadOnly={isReadOnly}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <InputDialog
        open={showNewArticleDialog}
        onOpenChange={setShowNewArticleDialog}
        title="New Article"
        description={`Create a new article in ${isDirectory ? node.name : node.path.split('/').slice(0, -1).join('/')}`}
        label="Article Name"
        placeholder="my-article"
        onConfirm={handleNewArticle}
        confirmText="Create"
      />

      <InputDialog
        open={showNewFolderDialog}
        onOpenChange={setShowNewFolderDialog}
        title="New Folder"
        description={`Create a new folder in ${isDirectory ? node.name : node.path.split('/').slice(0, -1).join('/')}`}
        label="Folder Name"
        placeholder="my-folder"
        onConfirm={handleNewFolder}
        confirmText="Create"
      />

      <InputDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        title={`Rename ${isDirectory ? 'Folder' : 'Article'}`}
        label="New Name"
        defaultValue={node.name}
        onConfirm={handleRename}
        confirmText="Rename"
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete ${isDirectory ? 'Folder' : 'Article'}`}
        description={`Are you sure you want to delete "${node.name}"? This action cannot be undone.${
          isDirectory ? ' The folder must be empty to be deleted.' : ''
        }`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}

export function Sidebar({ directories, onRefresh }: SidebarProps) {
  const appName = useWikiStore((state) => state.appName);
  const repositoryRefreshTrigger = useWikiStore((state) => state.repositoryRefreshTrigger);
  const router = useRouter();
  const pathname = usePathname();

  // Multi-repository state
  const [repositories, setRepositories] = useState<RepositoryStatus[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch repositories on mount and when refresh is triggered
  useEffect(() => {
    const fetchRepositories = async () => {
      setIsLoadingRepos(true);
      try {
        const response = await api.listRepositories();
        setRepositories(response.repositories || []);
      } catch (error: any) {
        console.error('Failed to fetch repositories:', error);
        // Don't show error toast - might be single-repo mode
        setRepositories([]);
      } finally {
        setIsLoadingRepos(false);
      }
    };

    fetchRepositories();
  }, [repositoryRefreshTrigger]);

  // Handle search
  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Root-level dialog states
  const [showRootNewArticleDialog, setShowRootNewArticleDialog] = useState(false);
  const [showRootNewFolderDialog, setShowRootNewFolderDialog] = useState(false);
  const [isRootDragOver, setIsRootDragOver] = useState(false);

  // Auto-scroll refs and state
  const navRef = useRef<HTMLElement>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // Auto-scroll logic
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (!navRef.current || !isDraggingRef.current) return;

      const nav = navRef.current;
      const rect = nav.getBoundingClientRect();
      const scrollZoneSize = 80; // Size of the edge zone that triggers scrolling
      const maxScrollSpeed = 15; // Maximum scroll speed in pixels per frame

      const distanceFromTop = e.clientY - rect.top;
      const distanceFromBottom = rect.bottom - e.clientY;

      let scrollSpeed = 0;

      // Calculate scroll speed based on proximity to edges
      if (distanceFromTop < scrollZoneSize && distanceFromTop > 0) {
        // Near top - scroll up
        const ratio = 1 - distanceFromTop / scrollZoneSize;
        scrollSpeed = -ratio * maxScrollSpeed;
      } else if (distanceFromBottom < scrollZoneSize && distanceFromBottom > 0) {
        // Near bottom - scroll down
        const ratio = 1 - distanceFromBottom / scrollZoneSize;
        scrollSpeed = ratio * maxScrollSpeed;
      }

      // Perform scroll if needed
      if (scrollSpeed !== 0) {
        if (!scrollAnimationRef.current) {
          const scroll = () => {
            if (navRef.current && scrollSpeed !== 0) {
              navRef.current.scrollTop += scrollSpeed;
              scrollAnimationRef.current = requestAnimationFrame(scroll);
            }
          };
          scrollAnimationRef.current = requestAnimationFrame(scroll);
        }
      } else if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
        scrollAnimationRef.current = null;
      }
    };

    const handleDragEnd = () => {
      isDraggingRef.current = false;
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
        scrollAnimationRef.current = null;
      }
    };

    const handleDragStart = () => {
      isDraggingRef.current = true;
    };

    // Add global listeners
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('drop', handleDragEnd);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDragEnd);
      document.removeEventListener('dragstart', handleDragStart);
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, []);

  const handleRootNewArticle = async (name: string) => {
    try {
      // Automatically add .md extension if not present
      const articleName = name.endsWith('.md') ? name : `${name}.md`;

      await api.createArticle({
        path: articleName,
        content: `# ${articleName.replace('.md', '')}\n\nStart writing your article here...`,
      });

      toast.success(`Article "${articleName}" created`);
      setShowRootNewArticleDialog(false);
      onRefresh?.();
      router.push(`/${articleName}?edit=true`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create article');
    }
  };

  const handleRootNewFolder = async (name: string) => {
    try {
      await api.createDirectory(name);
      toast.success(`Folder "${name}" created`);
      setShowRootNewFolderDialog(false);
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create folder');
    }
  };

  // Root workspace drag and drop handlers
  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsRootDragOver(true);
  };

  const handleRootDragLeave = (e: React.DragEvent) => {
    setIsRootDragOver(false);
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRootDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const sourcePath = data.path;
      const sourceType = data.type;
      const sourceName = data.name;
      const sourceRepositoryId = data.repositoryId;

      // Only allow root drop in single-repo mode (no repositoryId)
      if (sourceRepositoryId !== null) {
        toast.error('Cannot move repository files to root. Use repository structure.');
        return;
      }

      // Calculate new path (root level)
      const newPath = sourceName;

      // Move the item
      if (sourceType === 'directory') {
        await api.moveDirectory(sourcePath, newPath);
        toast.success(`Moved folder to root`);
      } else {
        await api.moveArticle(sourcePath, newPath);
        toast.success(`Moved article to root`);
      }

      // Refresh the tree
      onRefresh?.();

      // If it was the current article, navigate to new location
      if (sourceType === 'file' && pathname === `/${sourcePath}`) {
        router.push(`/${newPath}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to move item');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="h-14 flex items-center px-4 border-b border-gray-200/50 shrink-0">
        <div className="flex items-center gap-2 font-bold text-gray-800 tracking-tight">
          <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center text-white">
            <span className="text-xs">WG</span>
          </div>
          <span>{appName}</span>
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
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
      <nav ref={navRef} className="flex-1 overflow-y-auto py-2">
        <div
          className={`px-4 mb-2 text-[11px] font-bold uppercase tracking-wider rounded-md transition-colors ${
            isRootDragOver
              ? 'bg-blue-100 text-blue-600 border-2 border-blue-500 border-dashed'
              : 'text-gray-400'
          }`}
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
        >
          Workspace
        </div>

        {isLoadingRepos ? (
          <p className="text-gray-400 text-sm px-4 py-2">Loading repositories...</p>
        ) : repositories.length > 0 ? (
          <div>
            {repositories
              .filter(repo => repo.enabled)
              .map((repo) => (
                <RepositoryNode
                  key={repo.id}
                  repository={repo}
                  onRefresh={onRefresh}
                  renderTreeNodes={(nodes, repositoryId, isReadOnly) => (
                    <>
                      {nodes.map((node, index) => (
                        <TreeNode
                          key={`${node.type}:${node.path}:${index}`}
                          node={node}
                          level={1}
                          onRefresh={onRefresh}
                          repositoryId={repositoryId}
                          isReadOnly={isReadOnly}
                        />
                      ))}
                    </>
                  )}
                />
              ))}
          </div>
        ) : directories.length === 0 ? (
          <p className="text-gray-400 text-sm px-4">No articles yet</p>
        ) : (
          <div>
            {directories.map((node, index) => (
              <TreeNode key={`${node.type}:${node.path}:${index}`} node={node} level={0} onRefresh={onRefresh} />
            ))}
          </div>
        )}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-gray-200/50 text-xs text-gray-500 flex justify-between items-center">
        <span>v2.4.0</span>
        <Link href="/admin" className="hover:text-gray-800 transition-colors">
          Settings
        </Link>
      </div>

      {/* Root-level Dialogs */}
      <InputDialog
        open={showRootNewArticleDialog}
        onOpenChange={setShowRootNewArticleDialog}
        title="New Article"
        description="Create a new article in the root workspace"
        label="Article Name"
        placeholder="my-article"
        onConfirm={handleRootNewArticle}
        confirmText="Create"
      />

      <InputDialog
        open={showRootNewFolderDialog}
        onOpenChange={setShowRootNewFolderDialog}
        title="New Folder"
        description="Create a new folder in the root workspace"
        label="Folder Name"
        placeholder="my-folder"
        onConfirm={handleRootNewFolder}
        confirmText="Create"
      />
    </div>
  );
}

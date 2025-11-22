'use client';

/**
 * Sidebar component with recursive file tree navigation
 * Flat design with gray-50 background and blue active states
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, ChevronRight, ChevronDown, Search, FilePlus, FolderPlus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DirectoryNode } from '@/types/api';
import { useWikiStore } from '@/lib/store';
import { api } from '@/lib/api';
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
  onRefresh: () => void;
}

interface TreeNodeProps {
  node: DirectoryNode;
  level: number;
  onRefresh: () => void;
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

function TreeNode({ node, level, onRefresh }: TreeNodeProps) {
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

  const handleNewArticle = async (name: string) => {
    try {
      // Automatically add .md extension if not present
      const articleName = name.endsWith('.md') ? name : `${name}.md`;

      const basePath = isDirectory ? node.path : node.path.split('/').slice(0, -1).join('/');
      const newPath = basePath ? `${basePath}/${articleName}` : articleName;

      await api.createArticle({
        path: newPath,
        content: `# ${articleName.replace('.md', '')}\n\nStart writing your article here...`,
      });

      toast.success(`Article "${articleName}" created`);
      setShowNewArticleDialog(false);
      onRefresh();
      router.push(`/article/${newPath}?edit=true`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create article');
    }
  };

  const handleNewFolder = async (name: string) => {
    try {
      const basePath = isDirectory ? node.path : node.path.split('/').slice(0, -1).join('/');
      const newPath = basePath ? `${basePath}/${name}` : name;

      await api.createDirectory(newPath);
      toast.success(`Folder "${name}" created`);
      setShowNewFolderDialog(false);
      onRefresh();

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
        await api.moveDirectory(node.path, newPath);
        toast.success(`Folder renamed to "${newName}"`);
      } else {
        // For articles, the newName might not have .md extension
        // The API will handle adding it if needed
        await api.moveArticle(node.path, newPath);
        toast.success(`Article renamed to "${newName}"`);

        // If renaming the current article, navigate to new location
        if (isActive) {
          router.push(`/article/${newPath}`);
        }
      }

      setShowRenameDialog(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to rename');
    }
  };

  const handleDelete = async () => {
    try {
      if (isDirectory) {
        await api.deleteDirectory(node.path);
        toast.success(`Folder "${node.name}" deleted`);
      } else {
        await api.deleteArticle(node.path);
        toast.success(`Article "${node.name}" deleted`);

        if (isActive) {
          router.push('/');
        }
      }

      setShowDeleteConfirm(false);
      onRefresh();
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
    }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    // Only allow drop on directories
    if (isDirectory) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    setIsDragOver(false);
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
        await api.moveDirectory(sourcePath, newPath);
        toast.success(`Moved folder to ${node.name}`);
      } else {
        await api.moveArticle(sourcePath, newPath);
        toast.success(`Moved article to ${node.name}`);
      }

      // Refresh the tree
      onRefresh();

      // If it was the current article, navigate to new location
      if (sourceType === 'file' && pathname === `/article/${sourcePath}`) {
        router.push(`/article/${newPath}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to move item');
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
        href={`/article/${node.path}`}
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
              <ContextMenuItem onClick={() => setShowNewArticleDialog(true)}>
                <FilePlus className="mr-2 h-4 w-4" />
                New Article
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setShowNewFolderDialog(true)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setShowRenameDialog(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem onClick={() => setShowRenameDialog(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {isDirectory && hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode key={`${child.type}:${child.path}`} node={child} level={level + 1} onRefresh={onRefresh} />
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
  const router = useRouter();
  const pathname = usePathname();

  // Root-level dialog states
  const [showRootNewArticleDialog, setShowRootNewArticleDialog] = useState(false);
  const [showRootNewFolderDialog, setShowRootNewFolderDialog] = useState(false);
  const [isRootDragOver, setIsRootDragOver] = useState(false);

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
      onRefresh();
      router.push(`/article/${articleName}?edit=true`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create article');
    }
  };

  const handleRootNewFolder = async (name: string) => {
    try {
      await api.createDirectory(name);
      toast.success(`Folder "${name}" created`);
      setShowRootNewFolderDialog(false);
      onRefresh();
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
      onRefresh();

      // If it was the current article, navigate to new location
      if (sourceType === 'file' && pathname === `/article/${sourcePath}`) {
        router.push(`/article/${newPath}`);
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
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={`px-4 mb-2 text-[11px] font-bold uppercase tracking-wider cursor-context-menu rounded-md transition-colors ${
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
          </ContextMenuTrigger>
          <ContextMenuContent className="w-56">
            <ContextMenuItem onClick={() => setShowRootNewArticleDialog(true)}>
              <FilePlus className="mr-2 h-4 w-4" />
              New Article
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setShowRootNewFolderDialog(true)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New Folder
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {directories.length === 0 ? (
          <p className="text-gray-400 text-sm px-4">No articles yet</p>
        ) : (
          <div>
            {directories.map((node) => (
              <TreeNode key={`${node.type}:${node.path}`} node={node} level={0} onRefresh={onRefresh} />
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

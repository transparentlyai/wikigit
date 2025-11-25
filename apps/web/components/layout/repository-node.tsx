'use client';

/**
 * RepositoryNode component for multi-repository support
 * Displays a repository with expand/collapse and fetches its directory tree
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FolderGit, ChevronRight, ChevronDown, Lock, FilePlus, FolderPlus } from 'lucide-react';
import { RepositoryStatus, DirectoryNode } from '@/types/api';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { InputDialog } from '@/components/ui/input-dialog';

interface RepositoryNodeProps {
  repository: RepositoryStatus;
  onRefresh?: () => void;
  renderTreeNodes: (nodes: DirectoryNode[], repositoryId: string, isReadOnly: boolean, onRefresh: () => void) => React.ReactNode;
}

const REPO_EXPANDED_KEY_PREFIX = 'wikigit-repo-expanded-';

function getRepoExpandedState(repoId: string): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(`${REPO_EXPANDED_KEY_PREFIX}${repoId}`);
  return stored === 'true';
}

function saveRepoExpandedState(repoId: string, expanded: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${REPO_EXPANDED_KEY_PREFIX}${repoId}`, String(expanded));
}

export function RepositoryNode({ repository, onRefresh, renderTreeNodes }: RepositoryNodeProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [directories, setDirectories] = useState<DirectoryNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Dialog states
  const [showNewArticleDialog, setShowNewArticleDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  const fetchDirectories = async () => {
    setIsLoading(true);
    try {
      const response = await api.getDirectories(repository.id);
      setDirectories(response.tree);
    } catch (error: any) {
      toast.error(`Failed to load repository: ${error.message}`);
      setDirectories([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load expanded state from localStorage
  useEffect(() => {
    const expanded = getRepoExpandedState(repository.id);
    setIsExpanded(expanded);
    if (expanded) {
      fetchDirectories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository.id]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    saveRepoExpandedState(repository.id, newExpandedState);

    // Fetch directories when expanding
    if (newExpandedState && directories.length === 0) {
      await fetchDirectories();
    }
  };

  const handleNewArticle = async (name: string) => {
    try {
      // Automatically add .md extension if not present
      const articleName = name.endsWith('.md') ? name : `${name}.md`;

      await api.createArticle(repository.id, {
        path: articleName,
        content: `# ${articleName.replace('.md', '')}\n\nStart writing your article here...`,
      });

      toast.success(`Article "${articleName}" created`);
      setShowNewArticleDialog(false);
      await fetchDirectories();
      
      // Ensure the tree is expanded
      if (!isExpanded) {
        setIsExpanded(true);
        saveRepoExpandedState(repository.id, true);
      }
      
      router.push(`/${repository.id}/${articleName}?edit=true`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create article');
    }
  };

  const handleNewFolder = async (name: string) => {
    try {
      await api.createDirectory(repository.id, name);
      toast.success(`Folder "${name}" created`);
      setShowNewFolderDialog(false);
      await fetchDirectories();
      
      // Ensure the tree is expanded
      if (!isExpanded) {
        setIsExpanded(true);
        saveRepoExpandedState(repository.id, true);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create folder');
    }
  };

  return (
    <>
      <ContextMenu onOpenChange={setIsContextMenuOpen}>
        <ContextMenuTrigger asChild>
          <div
            className={`group flex items-center gap-2 px-3 py-1.5 mx-2 rounded-md cursor-pointer text-sm transition-colors select-none ${
              isContextMenuOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={handleToggle}
            style={{ paddingLeft: '12px' }}
          >
            <span className="opacity-50">
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </span>
            <span className="opacity-50">
              <FolderGit size={14} />
            </span>
            <span className="truncate flex-1">{repository.name}</span>
            {repository.read_only && (
              <span className="opacity-50" title="Read-only repository">
                <Lock size={12} />
              </span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem
            onClick={() => setShowNewArticleDialog(true)}
            disabled={repository.read_only}
          >
            <FilePlus className="mr-2 h-4 w-4" />
            New Article
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => setShowNewFolderDialog(true)}
            disabled={repository.read_only}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            New Folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isExpanded && (
        <div>
          {isLoading ? (
            <div className="text-gray-400 text-sm px-4 py-1" style={{ paddingLeft: '36px' }}>
              Loading...
            </div>
          ) : directories.length === 0 ? (
            <div className="text-gray-400 text-sm px-4 py-1" style={{ paddingLeft: '36px' }}>
              No files
            </div>
          ) : (
            renderTreeNodes(directories, repository.id, repository.read_only, fetchDirectories)
          )}
        </div>
      )}

      {/* Dialogs */}
      <InputDialog
        open={showNewArticleDialog}
        onOpenChange={setShowNewArticleDialog}
        title="New Article"
        description={`Create a new article in ${repository.name}`}
        label="Article Name"
        placeholder="my-article"
        onConfirm={handleNewArticle}
        confirmText="Create"
      />

      <InputDialog
        open={showNewFolderDialog}
        onOpenChange={setShowNewFolderDialog}
        title="New Folder"
        description={`Create a new folder in ${repository.name}`}
        label="Folder Name"
        placeholder="my-folder"
        onConfirm={handleNewFolder}
        confirmText="Create"
      />
    </>
  );
}

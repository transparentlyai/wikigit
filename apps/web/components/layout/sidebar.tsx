"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import { DirectoryNode, RepositoryStatus } from "@/types/api";
import { useWikiStore } from "@/lib/store";
import { api } from "@/lib/api";
import { RepositoryNode } from "./repository-node";
import { TreeNode } from "./tree-node";
import { InputDialog } from "@/components/ui/input-dialog";

interface SidebarProps {
  directories: DirectoryNode[];
  onRefresh?: () => void;
}

const EXPANDED_NODES_KEY = "wikigit-expanded-nodes";

export function getExpandedNodes(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const stored = localStorage.getItem(EXPANDED_NODES_KEY);
  return stored ? new Set(JSON.parse(stored)) : new Set();
}

export function saveExpandedNodes(nodes: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(EXPANDED_NODES_KEY, JSON.stringify(Array.from(nodes)));
}

export function Sidebar({ directories, onRefresh }: SidebarProps) {
  const appName = useWikiStore((state) => state.appName);
  const repositoryRefreshTrigger = useWikiStore(
    (state) => state.repositoryRefreshTrigger,
  );
  const router = useRouter();
  const pathname = usePathname();

  // Multi-repository state
  const [repositories, setRepositories] = useState<RepositoryStatus[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch repositories on mount and when refresh is triggered
  useEffect(() => {
    const fetchRepositories = async () => {
      setIsLoadingRepos(true);
      try {
        const response = await api.listRepositories();
        setRepositories(response.repositories || []);
      } catch (error: any) {
        console.error("Failed to fetch repositories:", error);
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
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Root-level dialog states
  const [showRootNewArticleDialog, setShowRootNewArticleDialog] =
    useState(false);
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
      } else if (
        distanceFromBottom < scrollZoneSize &&
        distanceFromBottom > 0
      ) {
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
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("dragend", handleDragEnd);
    document.addEventListener("drop", handleDragEnd);
    document.addEventListener("dragstart", handleDragStart);

    return () => {
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("dragend", handleDragEnd);
      document.removeEventListener("drop", handleDragEnd);
      document.removeEventListener("dragstart", handleDragStart);
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, []);

  const handleRootNewArticle = async (name: string) => {
    try {
      // Automatically add .md extension if not present
      const articleName = name.endsWith(".md") ? name : `${name}.md`;

      const result = await api.createArticle({
        path: articleName,
        content: `# ${articleName.replace(".md", "")}\n\nStart writing your article here...`,
      });

      if (result.warning) {
        toast.error(result.warning);
      } else {
        toast.success(`Article "${articleName}" created`);
      }
      setShowRootNewArticleDialog(false);
      onRefresh?.();
      router.push(`/${articleName}?edit=true`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create article");
    }
  };

  const handleRootNewFolder = async (name: string) => {
    try {
      await api.createDirectory(name);
      toast.success(`Folder "${name}" created`);
      setShowRootNewFolderDialog(false);
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to create folder");
    }
  };

  // Root workspace drag and drop handlers
  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsRootDragOver(true);
  };

  const handleRootDragLeave = () => {
    setIsRootDragOver(false);
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRootDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      const sourcePath = data.path;
      const sourceType = data.type;
      const sourceName = data.name;
      const sourceRepositoryId = data.repositoryId;

      // Only allow root drop in single-repo mode (no repositoryId)
      if (sourceRepositoryId !== null) {
        toast.error(
          "Cannot move repository files to root. Use repository structure.",
        );
        return;
      }

      // Calculate new path (root level)
      const newPath = sourceName;

      // Move the item
      if (sourceType === "directory") {
        await api.moveDirectory(sourcePath, newPath);
        toast.success(`Moved folder to root`);
      } else {
        const moveResult = await api.moveArticle(sourcePath, newPath);
        if (moveResult.warning) {
          toast.error(moveResult.warning);
        } else {
          toast.success(`Moved article to root`);
        }
      }

      // Refresh the tree
      onRefresh?.();

      // If it was the current article, navigate to new location
      if (sourceType === "file" && pathname === `/${sourcePath}`) {
        router.push(`/${newPath}`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to move item");
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
              ? "bg-blue-100 text-blue-600 border-2 border-blue-500 border-dashed"
              : "text-gray-400"
          }`}
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
        >
          Workspace
        </div>

        {isLoadingRepos ? (
          <p className="text-gray-400 text-sm px-4 py-2">
            Loading repositories...
          </p>
        ) : repositories.length > 0 ? (
          <div>
            {repositories
              .filter((repo) => repo.enabled)
              .map((repo) => (
                <RepositoryNode
                  key={repo.id}
                  repository={repo}
                  onRefresh={onRefresh}
                  renderTreeNodes={(
                    nodes,
                    repositoryId,
                    isReadOnly,
                    refreshRepo,
                  ) => (
                    <>
                      {nodes.map((node, index) => (
                        <TreeNode
                          key={`${node.type}:${node.path}:${index}`}
                          node={node}
                          level={1}
                          onRefresh={refreshRepo}
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
              <TreeNode
                key={`${node.type}:${node.path}:${index}`}
                node={node}
                level={0}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        )}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-gray-200/50 text-xs text-gray-500 flex justify-between items-center">
        <span>v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
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

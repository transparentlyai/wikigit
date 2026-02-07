"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  ChevronRight,
  ChevronDown,
  FilePlus,
  FolderPlus,
  Edit,
  Trash2,
} from "lucide-react";
import { DirectoryNode } from "@/types/api";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InputDialog } from "@/components/ui/input-dialog";
import { getExpandedNodes, saveExpandedNodes } from "./sidebar";
import { useTreeNodeActions } from "./use-tree-node-actions";

export interface TreeNodeProps {
  node: DirectoryNode;
  level: number;
  onRefresh?: () => void;
  repositoryId?: string;
  isReadOnly?: boolean;
}

export function TreeNode({
  node,
  level,
  onRefresh,
  repositoryId,
  isReadOnly = false,
}: TreeNodeProps) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Auto-expand timer
  const expandTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Ref for auto-scrolling active node into view
  const nodeRef = useRef<HTMLDivElement>(null);

  const hasChildren =
    node.type === "directory" && node.children && node.children.length > 0;

  const {
    isActive,
    isDirectory,
    articleUrl,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showRenameDialog,
    setShowRenameDialog,
    showNewArticleDialog,
    setShowNewArticleDialog,
    showNewFolderDialog,
    setShowNewFolderDialog,
    handleNewArticle,
    handleNewFolder,
    handleRename,
    handleDelete,
    handleDrop: onDrop,
  } = useTreeNodeActions({ node, repositoryId, isReadOnly, onRefresh });

  // Auto-expand if the current pathname is within this node's subtree
  useEffect(() => {
    const expandedNodes = getExpandedNodes();
    const alreadyExpanded = expandedNodes.has(node.path);

    if (isDirectory) {
      const shouldAutoExpand =
        pathname === articleUrl || pathname.startsWith(articleUrl + "/");
      if (shouldAutoExpand && !alreadyExpanded) {
        setIsExpanded(true);
        expandedNodes.add(node.path);
        saveExpandedNodes(expandedNodes);
        return;
      }
    }

    setIsExpanded(alreadyExpanded);
  }, [node.path, pathname, articleUrl, isDirectory]);

  // Scroll active node into view
  useEffect(() => {
    if (isActive && nodeRef.current) {
      // Small delay to let parent expansions render first
      const timer = setTimeout(() => {
        nodeRef.current?.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

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

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        path: node.path,
        type: node.type,
        name: node.name,
        repositoryId: repositoryId || null,
      }),
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    // Only allow drop on directories
    if (isDirectory) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
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

  const handleDragLeave = () => {
    setIsDragOver(false);

    // Clear auto-expand timer when leaving
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    setIsDragOver(false);
    onDrop(e);
  };

  const paddingLeft = `${level * 12 + 12}px`;

  const renderContent = () => {
    const chevron = isDirectory && hasChildren && (
      <span className={`opacity-50 ${isActive ? "text-blue-500" : ""}`}>
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </span>
    );

    const icon = !isDirectory && (
      <span className={`opacity-50 ${isActive ? "text-blue-500" : ""}`}>
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
          ? "bg-blue-50 text-blue-700 font-medium"
          : isContextMenuOpen
            ? "bg-gray-100 text-gray-900"
            : isDragOver
              ? "bg-blue-100 border-2 border-blue-500 border-dashed"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }
    `;

    if (isDirectory) {
      return (
        <Link
          href={articleUrl}
          className={className}
          onClick={(e) => {
            if (isActive) {
              // Already on this directory page — just toggle expansion
              e.preventDefault();
              handleToggle(e);
            } else {
              // Navigate to directory page and expand
              const expandedNodes = getExpandedNodes();
              expandedNodes.add(node.path);
              saveExpandedNodes(expandedNodes);
              setIsExpanded(true);
            }
          }}
          style={{ paddingLeft }}
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {content}
        </Link>
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
          <div ref={nodeRef}>{renderContent()}</div>
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
        description={`Create a new article in ${isDirectory ? node.name : node.path.split("/").slice(0, -1).join("/")}`}
        label="Article Name"
        placeholder="my-article"
        onConfirm={handleNewArticle}
        confirmText="Create"
      />

      <InputDialog
        open={showNewFolderDialog}
        onOpenChange={setShowNewFolderDialog}
        title="New Folder"
        description={`Create a new folder in ${isDirectory ? node.name : node.path.split("/").slice(0, -1).join("/")}`}
        label="Folder Name"
        placeholder="my-folder"
        onConfirm={handleNewFolder}
        confirmText="Create"
      />

      <InputDialog
        open={showRenameDialog}
        onOpenChange={setShowRenameDialog}
        title={`Rename ${isDirectory ? "Folder" : "Article"}`}
        label="New Name"
        defaultValue={node.name}
        onConfirm={handleRename}
        confirmText="Rename"
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete ${isDirectory ? "Folder" : "Article"}`}
        description={`Are you sure you want to delete "${node.name}"? This action cannot be undone.${
          isDirectory ? " The folder must be empty to be deleted." : ""
        }`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </>
  );
}

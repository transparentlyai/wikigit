"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { DirectoryNode } from "@/types/api";
import { api } from "@/lib/api";

interface UseTreeNodeActionsParams {
  node: DirectoryNode;
  repositoryId?: string;
  isReadOnly?: boolean;
  onRefresh?: () => void;
}

export function useTreeNodeActions({
  node,
  repositoryId,
  isReadOnly = false,
  onRefresh,
}: UseTreeNodeActionsParams) {
  const pathname = usePathname();
  const router = useRouter();

  const isDirectory = node.type === "directory";

  // Construct article path with repository ID if in multi-repo mode
  const articleUrl = repositoryId
    ? `/${repositoryId}/${node.path}`
    : `/${node.path}`;
  const isActive = pathname === articleUrl;

  // Dialog states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showNewArticleDialog, setShowNewArticleDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);

  const handleNewArticle = async (name: string) => {
    try {
      // Automatically add .md extension if not present
      const articleName = name.endsWith(".md") ? name : `${name}.md`;

      const basePath = isDirectory
        ? node.path
        : node.path.split("/").slice(0, -1).join("/");
      const newPath = basePath ? `${basePath}/${articleName}` : articleName;

      const result = repositoryId
        ? await api.createArticle(repositoryId, {
            path: newPath,
            content: `# ${articleName.replace(".md", "")}\n\nStart writing your article here...`,
          })
        : await api.createArticle({
            path: newPath,
            content: `# ${articleName.replace(".md", "")}\n\nStart writing your article here...`,
          });

      if (result.warning) {
        toast.error(result.warning);
      } else {
        toast.success(`Article "${articleName}" created`);
      }
      setShowNewArticleDialog(false);
      onRefresh?.();
      const articlePath = repositoryId ? `${repositoryId}/${newPath}` : newPath;
      router.push(`/${articlePath}?edit=true`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create article");
    }
  };

  const handleNewFolder = async (name: string) => {
    try {
      const basePath = isDirectory
        ? node.path
        : node.path.split("/").slice(0, -1).join("/");
      const newPath = basePath ? `${basePath}/${name}` : name;

      if (repositoryId) {
        await api.createDirectory(repositoryId, newPath);
      } else {
        await api.createDirectory(newPath);
      }
      toast.success(`Folder "${name}" created`);
      setShowNewFolderDialog(false);
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to create folder");
    }
  };

  const handleRename = async (newName: string) => {
    try {
      // Validate new name
      if (!newName || newName.trim() === "") {
        toast.error("Name cannot be empty");
        return;
      }

      // Don't rename if name hasn't changed
      if (newName === node.name) {
        setShowRenameDialog(false);
        return;
      }

      // Calculate new path
      const pathParts = node.path.split("/");
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join("/");

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
        const moveResult = repositoryId
          ? await api.moveArticle(repositoryId, node.path, newPath)
          : await api.moveArticle(node.path, newPath);
        if (moveResult.warning) {
          toast.error(moveResult.warning);
        } else {
          toast.success(`Article renamed to "${newName}"`);
        }

        // If renaming the current article, navigate to new location
        if (isActive) {
          const articlePath = repositoryId
            ? `${repositoryId}/${newPath}`
            : newPath;
          router.push(`/${articlePath}`);
        }
      }

      setShowRenameDialog(false);
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to rename");
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

        // If currently viewing a file in this directory, redirect to home
        if (pathname === articleUrl || pathname.startsWith(`${articleUrl}/`)) {
          router.push("/");
        }
      } else {
        if (repositoryId) {
          await api.deleteArticle(repositoryId, node.path);
        } else {
          await api.deleteArticle(node.path);
        }
        toast.success(`Article "${node.name}" deleted`);

        if (isActive) {
          router.push("/");
        }
      }

      setShowDeleteConfirm(false);
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete");
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only allow drop on directories
    if (!isDirectory) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      const sourcePath = data.path;
      const sourceType = data.type;
      const sourceName = data.name;
      const sourceRepositoryId = data.repositoryId;

      // Validate same repository
      if (sourceRepositoryId !== (repositoryId || null)) {
        toast.error("Cannot move files between repositories");
        return;
      }

      // Don't allow dropping on self
      if (sourcePath === node.path) return;

      // Don't allow dropping a directory into its own child
      if (
        sourceType === "directory" &&
        node.path.startsWith(sourcePath + "/")
      ) {
        toast.error("Cannot move a directory into itself");
        return;
      }

      // Calculate new path
      const newPath = `${node.path}/${sourceName}`;

      // Move the item
      if (sourceType === "directory") {
        if (repositoryId) {
          await api.moveDirectory(repositoryId, sourcePath, newPath);
        } else {
          await api.moveDirectory(sourcePath, newPath);
        }
        toast.success(`Moved folder to ${node.name}`);
      } else {
        const moveResult = repositoryId
          ? await api.moveArticle(repositoryId, sourcePath, newPath)
          : await api.moveArticle(sourcePath, newPath);
        if (moveResult.warning) {
          toast.error(moveResult.warning);
        } else {
          toast.success(`Moved article to ${node.name}`);
        }
      }

      // Refresh the tree
      onRefresh?.();

      // If it was the current article, navigate to new location
      const sourceArticleUrl = repositoryId
        ? `/${repositoryId}/${sourcePath}`
        : `/${sourcePath}`;
      if (sourceType === "file" && pathname === sourceArticleUrl) {
        const newArticleUrl = repositoryId
          ? `/${repositoryId}/${newPath}`
          : `/${newPath}`;
        router.push(newArticleUrl);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to move item");
    }
  };

  return {
    isActive,
    isDirectory,
    articleUrl,
    // Dialog states
    showDeleteConfirm,
    setShowDeleteConfirm,
    showRenameDialog,
    setShowRenameDialog,
    showNewArticleDialog,
    setShowNewArticleDialog,
    showNewFolderDialog,
    setShowNewFolderDialog,
    // Handlers
    handleNewArticle,
    handleNewFolder,
    handleRename,
    handleDelete,
    handleDrop,
  };
}

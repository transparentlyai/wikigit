import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks - vi.hoisted ensures values are available when vi.mock factories run
// ---------------------------------------------------------------------------

const { mockPush, mockPathname, mockToast, mockApi } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockPathname: vi.fn().mockReturnValue("/"),
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockApi: {
    createArticle: vi.fn(),
    createDirectory: vi.fn(),
    moveArticle: vi.fn(),
    moveDirectory: vi.fn(),
    deleteArticle: vi.fn(),
    deleteDirectory: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("react-hot-toast", () => ({ default: mockToast }));

vi.mock("@/lib/api", () => ({ api: mockApi }));

import { useTreeNodeActions } from "@/components/layout/use-tree-node-actions";
import type { DirectoryNode } from "@/types/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(
  overrides: Partial<DirectoryNode> = {},
): DirectoryNode {
  return {
    type: "file",
    name: "article.md",
    path: "docs/article.md",
    ...overrides,
  };
}

function makeDirNode(
  overrides: Partial<DirectoryNode> = {},
): DirectoryNode {
  return {
    type: "directory",
    name: "docs",
    path: "docs",
    children: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useTreeNodeActions", () => {
  const onRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/");
  });

  // ----- Computed properties -----------------------------------------------

  describe("isDirectory", () => {
    it("returns true for directory nodes", () => {
      const { result } = renderHook(() =>
        useTreeNodeActions({ node: makeDirNode(), onRefresh }),
      );
      expect(result.current.isDirectory).toBe(true);
    });

    it("returns false for file nodes", () => {
      const { result } = renderHook(() =>
        useTreeNodeActions({ node: makeNode(), onRefresh }),
      );
      expect(result.current.isDirectory).toBe(false);
    });
  });

  describe("articleUrl", () => {
    it("returns path prefixed with / when no repositoryId", () => {
      const { result } = renderHook(() =>
        useTreeNodeActions({ node: makeNode({ path: "Home.md" }), onRefresh }),
      );
      expect(result.current.articleUrl).toBe("/Home.md");
    });

    it("includes repositoryId in path when provided", () => {
      const { result } = renderHook(() =>
        useTreeNodeActions({
          node: makeNode({ path: "Home.md" }),
          repositoryId: "my-repo",
          onRefresh,
        }),
      );
      expect(result.current.articleUrl).toBe("/my-repo/Home.md");
    });
  });

  describe("isActive", () => {
    it("is true when pathname matches articleUrl", () => {
      mockPathname.mockReturnValue("/docs/article.md");

      const { result } = renderHook(() =>
        useTreeNodeActions({ node: makeNode(), onRefresh }),
      );
      expect(result.current.isActive).toBe(true);
    });

    it("is false when pathname does not match articleUrl", () => {
      mockPathname.mockReturnValue("/other.md");

      const { result } = renderHook(() =>
        useTreeNodeActions({ node: makeNode(), onRefresh }),
      );
      expect(result.current.isActive).toBe(false);
    });
  });

  // ----- handleNewArticle --------------------------------------------------

  describe("handleNewArticle", () => {
    it("adds .md extension if missing", async () => {
      mockApi.createArticle.mockResolvedValue({ path: "docs/my-page.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node: makeDirNode(), onRefresh }),
      );

      await act(async () => {
        await result.current.handleNewArticle("my-page");
      });

      expect(mockApi.createArticle).toHaveBeenCalledWith(
        expect.objectContaining({ path: "docs/my-page.md" }),
      );
    });

    it("does not double-add .md extension", async () => {
      mockApi.createArticle.mockResolvedValue({ path: "docs/my-page.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node: makeDirNode(), onRefresh }),
      );

      await act(async () => {
        await result.current.handleNewArticle("my-page.md");
      });

      expect(mockApi.createArticle).toHaveBeenCalledWith(
        expect.objectContaining({ path: "docs/my-page.md" }),
      );
    });

    it("constructs correct path for directory context", async () => {
      mockApi.createArticle.mockResolvedValue({ path: "docs/new.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({
          node: makeDirNode({ path: "docs", name: "docs" }),
          onRefresh,
        }),
      );

      await act(async () => {
        await result.current.handleNewArticle("new");
      });

      expect(mockApi.createArticle).toHaveBeenCalledWith(
        expect.objectContaining({ path: "docs/new.md" }),
      );
    });

    it("constructs correct path from a file node sibling context", async () => {
      mockApi.createArticle.mockResolvedValue({ path: "docs/sibling.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({
          node: makeNode({ path: "docs/article.md" }),
          onRefresh,
        }),
      );

      await act(async () => {
        await result.current.handleNewArticle("sibling");
      });

      // Parent dir of "docs/article.md" is "docs"
      expect(mockApi.createArticle).toHaveBeenCalledWith(
        expect.objectContaining({ path: "docs/sibling.md" }),
      );
    });

    it("navigates to created article with ?edit=true", async () => {
      mockApi.createArticle.mockResolvedValue({ path: "docs/new.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node: makeDirNode({ path: "docs" }), onRefresh }),
      );

      await act(async () => {
        await result.current.handleNewArticle("new");
      });

      expect(mockPush).toHaveBeenCalledWith("/docs/new.md?edit=true");
      expect(mockToast.success).toHaveBeenCalledWith(
        'Article "new.md" created',
      );
    });

    it("navigates with repositoryId prefix when provided", async () => {
      mockApi.createArticle.mockResolvedValue({ path: "new.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({
          node: makeDirNode({ path: "docs" }),
          repositoryId: "repo-1",
          onRefresh,
        }),
      );

      await act(async () => {
        await result.current.handleNewArticle("new");
      });

      expect(mockApi.createArticle).toHaveBeenCalledWith("repo-1", {
        path: "docs/new.md",
        content: expect.any(String),
      });
      expect(mockPush).toHaveBeenCalledWith(
        "/repo-1/docs/new.md?edit=true",
      );
    });

    it("shows warning toast if result has warning", async () => {
      mockApi.createArticle.mockResolvedValue({
        path: "docs/new.md",
        warning: "File already existed, overwritten",
      });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node: makeDirNode({ path: "docs" }), onRefresh }),
      );

      await act(async () => {
        await result.current.handleNewArticle("new");
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        "File already existed, overwritten",
      );
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it("shows error toast on API failure", async () => {
      mockApi.createArticle.mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useTreeNodeActions({ node: makeDirNode({ path: "docs" }), onRefresh }),
      );

      await act(async () => {
        await result.current.handleNewArticle("new");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Network error");
    });
  });

  // ----- handleNewFolder ---------------------------------------------------

  describe("handleNewFolder", () => {
    it("creates directory at correct path for directory context", async () => {
      mockApi.createDirectory.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useTreeNodeActions({ node: makeDirNode({ path: "docs" }), onRefresh }),
      );

      await act(async () => {
        await result.current.handleNewFolder("sub-folder");
      });

      expect(mockApi.createDirectory).toHaveBeenCalledWith("docs/sub-folder");
      expect(mockToast.success).toHaveBeenCalledWith(
        'Folder "sub-folder" created',
      );
      expect(onRefresh).toHaveBeenCalled();
    });

    it("uses repositoryId when provided", async () => {
      mockApi.createDirectory.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useTreeNodeActions({
          node: makeDirNode({ path: "docs" }),
          repositoryId: "repo-1",
          onRefresh,
        }),
      );

      await act(async () => {
        await result.current.handleNewFolder("sub-folder");
      });

      expect(mockApi.createDirectory).toHaveBeenCalledWith(
        "repo-1",
        "docs/sub-folder",
      );
    });
  });

  // ----- handleRename ------------------------------------------------------

  describe("handleRename", () => {
    it("rejects empty name", async () => {
      const { result } = renderHook(() =>
        useTreeNodeActions({ node: makeNode(), onRefresh }),
      );

      await act(async () => {
        await result.current.handleRename("");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Name cannot be empty");
      expect(mockApi.moveArticle).not.toHaveBeenCalled();
    });

    it("rejects whitespace-only name", async () => {
      const { result } = renderHook(() =>
        useTreeNodeActions({ node: makeNode(), onRefresh }),
      );

      await act(async () => {
        await result.current.handleRename("   ");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Name cannot be empty");
    });

    it("skips rename when name unchanged", async () => {
      const node = makeNode({ name: "article.md", path: "docs/article.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      await act(async () => {
        await result.current.handleRename("article.md");
      });

      expect(mockApi.moveArticle).not.toHaveBeenCalled();
      expect(mockApi.moveDirectory).not.toHaveBeenCalled();
    });

    it("moves article to new path", async () => {
      mockApi.moveArticle.mockResolvedValue({ path: "docs/renamed.md" });

      const node = makeNode({ name: "article.md", path: "docs/article.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      await act(async () => {
        await result.current.handleRename("renamed.md");
      });

      expect(mockApi.moveArticle).toHaveBeenCalledWith(
        "docs/article.md",
        "docs/renamed.md",
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        'Article renamed to "renamed.md"',
      );
      expect(onRefresh).toHaveBeenCalled();
    });

    it("moves directory to new path", async () => {
      mockApi.moveDirectory.mockResolvedValue(undefined);

      const node = makeDirNode({ name: "old-dir", path: "parent/old-dir" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      await act(async () => {
        await result.current.handleRename("new-dir");
      });

      expect(mockApi.moveDirectory).toHaveBeenCalledWith(
        "parent/old-dir",
        "parent/new-dir",
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        'Folder renamed to "new-dir"',
      );
    });

    it("uses repositoryId when renaming article in multi-repo mode", async () => {
      mockApi.moveArticle.mockResolvedValue({ path: "docs/renamed.md" });

      const node = makeNode({ name: "article.md", path: "docs/article.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({
          node,
          repositoryId: "repo-1",
          onRefresh,
        }),
      );

      await act(async () => {
        await result.current.handleRename("renamed.md");
      });

      expect(mockApi.moveArticle).toHaveBeenCalledWith(
        "repo-1",
        "docs/article.md",
        "docs/renamed.md",
      );
    });

    it("navigates when renaming the currently active article", async () => {
      mockPathname.mockReturnValue("/docs/article.md");
      mockApi.moveArticle.mockResolvedValue({ path: "docs/renamed.md" });

      const node = makeNode({ name: "article.md", path: "docs/article.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      await act(async () => {
        await result.current.handleRename("renamed.md");
      });

      expect(mockPush).toHaveBeenCalledWith("/docs/renamed.md");
    });

    it("shows warning toast when moveArticle returns a warning", async () => {
      mockApi.moveArticle.mockResolvedValue({
        path: "docs/renamed.md",
        warning: "Overwritten existing file",
      });

      const node = makeNode({ name: "article.md", path: "docs/article.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      await act(async () => {
        await result.current.handleRename("renamed.md");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Overwritten existing file");
    });
  });

  // ----- handleDelete ------------------------------------------------------

  describe("handleDelete", () => {
    it("deletes a file and calls onRefresh", async () => {
      mockApi.deleteArticle.mockResolvedValue(undefined);

      const node = makeNode({ name: "article.md", path: "docs/article.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      await act(async () => {
        await result.current.handleDelete();
      });

      expect(mockApi.deleteArticle).toHaveBeenCalledWith("docs/article.md");
      expect(mockToast.success).toHaveBeenCalledWith(
        'Article "article.md" deleted',
      );
      expect(onRefresh).toHaveBeenCalled();
    });

    it("deletes a directory and calls onRefresh", async () => {
      mockApi.deleteDirectory.mockResolvedValue(undefined);

      const node = makeDirNode({ name: "old-dir", path: "parent/old-dir" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      await act(async () => {
        await result.current.handleDelete();
      });

      expect(mockApi.deleteDirectory).toHaveBeenCalledWith("parent/old-dir");
      expect(mockToast.success).toHaveBeenCalledWith(
        'Folder "old-dir" deleted',
      );
      expect(onRefresh).toHaveBeenCalled();
    });

    it("redirects to / when deleting the active article", async () => {
      mockPathname.mockReturnValue("/docs/article.md");
      mockApi.deleteArticle.mockResolvedValue(undefined);

      const node = makeNode({ name: "article.md", path: "docs/article.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      await act(async () => {
        await result.current.handleDelete();
      });

      expect(mockPush).toHaveBeenCalledWith("/");
    });

    it("redirects to / when deleting a directory that contains the active page", async () => {
      mockPathname.mockReturnValue("/parent/old-dir/page.md");
      mockApi.deleteDirectory.mockResolvedValue(undefined);

      const node = makeDirNode({ name: "old-dir", path: "parent/old-dir" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      await act(async () => {
        await result.current.handleDelete();
      });

      expect(mockPush).toHaveBeenCalledWith("/");
    });

    it("does not redirect when deleting a non-active article", async () => {
      mockPathname.mockReturnValue("/other.md");
      mockApi.deleteArticle.mockResolvedValue(undefined);

      const node = makeNode({ name: "article.md", path: "docs/article.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      await act(async () => {
        await result.current.handleDelete();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("uses repositoryId when deleting in multi-repo mode", async () => {
      mockApi.deleteArticle.mockResolvedValue(undefined);

      const node = makeNode({ name: "article.md", path: "docs/article.md" });

      const { result } = renderHook(() =>
        useTreeNodeActions({
          node,
          repositoryId: "repo-1",
          onRefresh,
        }),
      );

      await act(async () => {
        await result.current.handleDelete();
      });

      expect(mockApi.deleteArticle).toHaveBeenCalledWith(
        "repo-1",
        "docs/article.md",
      );
    });
  });

  // ----- handleDrop --------------------------------------------------------

  describe("handleDrop", () => {
    function makeDragEvent(
      data: Record<string, unknown>,
    ): React.DragEvent {
      return {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: {
          getData: vi.fn().mockReturnValue(JSON.stringify(data)),
        },
      } as unknown as React.DragEvent;
    }

    it("rejects drop on non-directory nodes", async () => {
      const node = makeNode();

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      const event = makeDragEvent({
        path: "other.md",
        type: "file",
        name: "other.md",
        repositoryId: null,
      });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(mockApi.moveArticle).not.toHaveBeenCalled();
      expect(mockApi.moveDirectory).not.toHaveBeenCalled();
    });

    it("rejects cross-repository drops", async () => {
      const node = makeDirNode({ path: "docs" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, repositoryId: "repo-1", onRefresh }),
      );

      const event = makeDragEvent({
        path: "other.md",
        type: "file",
        name: "other.md",
        repositoryId: "repo-2",
      });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        "Cannot move files between repositories",
      );
      expect(mockApi.moveArticle).not.toHaveBeenCalled();
    });

    it("prevents dropping a directory into itself", async () => {
      const node = makeDirNode({ path: "parent/dir" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      const event = makeDragEvent({
        path: "parent",
        type: "directory",
        name: "parent",
        repositoryId: null,
      });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        "Cannot move a directory into itself",
      );
    });

    it("moves a file into the target directory", async () => {
      mockApi.moveArticle.mockResolvedValue({ path: "docs/moved.md" });

      const node = makeDirNode({ path: "docs", name: "docs" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      const event = makeDragEvent({
        path: "moved.md",
        type: "file",
        name: "moved.md",
        repositoryId: null,
      });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(mockApi.moveArticle).toHaveBeenCalledWith(
        "moved.md",
        "docs/moved.md",
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        "Moved article to docs",
      );
      expect(onRefresh).toHaveBeenCalled();
    });

    it("moves a directory into the target directory", async () => {
      mockApi.moveDirectory.mockResolvedValue(undefined);

      const node = makeDirNode({ path: "parent", name: "parent" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      const event = makeDragEvent({
        path: "child-dir",
        type: "directory",
        name: "child-dir",
        repositoryId: null,
      });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(mockApi.moveDirectory).toHaveBeenCalledWith(
        "child-dir",
        "parent/child-dir",
      );
      expect(mockToast.success).toHaveBeenCalledWith(
        "Moved folder to parent",
      );
    });

    it("navigates when the dropped file is the current article", async () => {
      mockPathname.mockReturnValue("/moved.md");
      mockApi.moveArticle.mockResolvedValue({ path: "docs/moved.md" });

      const node = makeDirNode({ path: "docs", name: "docs" });

      const { result } = renderHook(() =>
        useTreeNodeActions({ node, onRefresh }),
      );

      const event = makeDragEvent({
        path: "moved.md",
        type: "file",
        name: "moved.md",
        repositoryId: null,
      });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(mockPush).toHaveBeenCalledWith("/docs/moved.md");
    });

    it("uses repositoryId for move operations", async () => {
      mockApi.moveArticle.mockResolvedValue({ path: "docs/moved.md" });

      const node = makeDirNode({ path: "docs", name: "docs" });

      const { result } = renderHook(() =>
        useTreeNodeActions({
          node,
          repositoryId: "repo-1",
          onRefresh,
        }),
      );

      const event = makeDragEvent({
        path: "moved.md",
        type: "file",
        name: "moved.md",
        repositoryId: "repo-1",
      });

      await act(async () => {
        await result.current.handleDrop(event);
      });

      expect(mockApi.moveArticle).toHaveBeenCalledWith(
        "repo-1",
        "moved.md",
        "docs/moved.md",
      );
    });
  });
});

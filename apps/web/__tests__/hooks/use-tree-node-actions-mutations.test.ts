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
// Tests — handleRename & handleDelete
// ---------------------------------------------------------------------------

describe("useTreeNodeActions", () => {
  const onRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/");
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
});

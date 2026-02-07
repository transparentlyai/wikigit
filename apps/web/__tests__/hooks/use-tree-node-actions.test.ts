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
// Tests — computed properties, handleNewArticle, handleNewFolder
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
});

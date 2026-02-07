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

// ---------------------------------------------------------------------------
// Tests — handleDrop (drag & drop)
// ---------------------------------------------------------------------------

describe("useTreeNodeActions – handleDrop", () => {
  const onRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/");
  });

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

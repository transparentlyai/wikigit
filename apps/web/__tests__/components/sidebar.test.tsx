import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockPush, mockPathname, mockToast, mockApi, mockTriggerRepositoryRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockPathname: vi.fn().mockReturnValue("/"),
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockApi: {
    listRepositories: vi.fn(),
    getDirectories: vi.fn(),
    createArticle: vi.fn(),
    createDirectory: vi.fn(),
    moveArticle: vi.fn(),
    moveDirectory: vi.fn(),
    deleteArticle: vi.fn(),
    deleteDirectory: vi.fn(),
  },
  mockTriggerRepositoryRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush }),
}));

// Mock next/link to render a simple anchor
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("react-hot-toast", () => ({ default: mockToast }));
vi.mock("@/lib/api", () => ({ api: mockApi }));

// Mock zustand store
vi.mock("@/lib/store", () => ({
  useWikiStore: vi.fn((selector: any) =>
    selector({
      appName: "WikiGit",
      repositoryRefreshTrigger: 0,
      triggerRepositoryRefresh: mockTriggerRepositoryRefresh,
    }),
  ),
  useStore: vi.fn((selector: any) =>
    selector({
      appName: "WikiGit",
      repositoryRefreshTrigger: 0,
      triggerRepositoryRefresh: mockTriggerRepositoryRefresh,
    }),
  ),
}));

// Mock Radix ContextMenu to render items in a testable way
vi.mock("@/components/ui/context-menu", () => ({
  ContextMenu: ({ children }: any) => <div>{children}</div>,
  ContextMenuTrigger: ({ children }: any) => <div>{children}</div>,
  ContextMenuContent: ({ children }: any) => (
    <div data-testid="context-menu-content">{children}</div>
  ),
  ContextMenuItem: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  ContextMenuSeparator: () => <hr />,
}));

// Mock Radix AlertDialog
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open }: any) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogAction: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

// Mock Radix Dialog for InputDialog
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Search: () => <span data-testid="icon-search" />,
  FileText: () => <span data-testid="icon-file" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  FolderGit: () => <span data-testid="icon-folder-git" />,
  Lock: () => <span data-testid="icon-lock" />,
  FilePlus: () => <span data-testid="icon-file-plus" />,
  FolderPlus: () => <span data-testid="icon-folder-plus" />,
  Edit: () => <span data-testid="icon-edit" />,
  Trash2: () => <span data-testid="icon-trash" />,
}));

import { Sidebar, getExpandedNodes, saveExpandedNodes } from "@/components/layout/sidebar";
import type { DirectoryNode } from "@/types/api";

// ---------------------------------------------------------------------------
// localStorage mock (jsdom may not provide one for opaque origins)
// ---------------------------------------------------------------------------

const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockLocalStorage.store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage.store[key];
  }),
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleDirectories: DirectoryNode[] = [
  {
    type: "directory",
    name: "docs",
    path: "docs",
    children: [
      { type: "file", name: "intro.md", path: "docs/intro.md" },
      { type: "file", name: "setup.md", path: "docs/setup.md" },
    ],
  },
  { type: "file", name: "Home.md", path: "Home.md" },
];

const sampleRepositories = {
  repositories: [
    {
      id: "wiki-pages",
      name: "Wiki Pages",
      owner: "org",
      remote_url: "https://github.com/org/wiki.git",
      enabled: true,
      read_only: false,
      default_branch: "main",
      last_synced: "2026-01-01T00:00:00Z",
      sync_status: "synced" as const,
      error_message: null,
      local_path: "/data/repos/wiki",
      has_local_changes: false,
      ahead_of_remote: 0,
      behind_of_remote: 0,
    },
  ],
  total: 1,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/");
    // Default: no repositories (single-repo mode)
    mockApi.listRepositories.mockResolvedValue({
      repositories: [],
      total: 0,
    });

    // Reset localStorage mock
    mockLocalStorage.store = {};
  });

  it("renders without crashing", async () => {
    render(<Sidebar directories={[]} />);
    await waitFor(() => {
      expect(screen.getByText("WikiGit")).toBeInTheDocument();
    });
  });

  it("shows the app name from store", async () => {
    render(<Sidebar directories={[]} />);
    await waitFor(() => {
      expect(screen.getByText("WikiGit")).toBeInTheDocument();
    });
  });

  it("shows loading state while fetching repositories", () => {
    mockApi.listRepositories.mockReturnValue(new Promise(() => {}));

    render(<Sidebar directories={[]} />);
    expect(
      screen.getByText("Loading repositories..."),
    ).toBeInTheDocument();
  });

  it("renders 'No articles yet' when no dirs and no repos", async () => {
    mockApi.listRepositories.mockResolvedValue({
      repositories: [],
      total: 0,
    });

    render(<Sidebar directories={[]} />);

    await waitFor(() => {
      expect(screen.getByText("No articles yet")).toBeInTheDocument();
    });
  });

  it("renders tree nodes for single-repo directories", async () => {
    mockApi.listRepositories.mockResolvedValue({
      repositories: [],
      total: 0,
    });

    render(<Sidebar directories={sampleDirectories} />);

    await waitFor(() => {
      expect(screen.getByText("docs")).toBeInTheDocument();
      expect(screen.getByText("Home.md")).toBeInTheDocument();
    });
  });

  it("renders repository nodes when repositories exist", async () => {
    mockApi.listRepositories.mockResolvedValue(sampleRepositories);
    mockApi.getDirectories.mockResolvedValue({ tree: [] });

    render(<Sidebar directories={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Wiki Pages")).toBeInTheDocument();
    });
  });

  it("has a search input that accepts text", async () => {
    render(<Sidebar directories={[]} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search docs...")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search docs...");
    fireEvent.change(searchInput, { target: { value: "hello" } });
    expect(searchInput).toHaveValue("hello");
  });

  it("search navigates on Enter", async () => {
    render(<Sidebar directories={[]} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search docs...")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search docs...");
    fireEvent.change(searchInput, { target: { value: "query" } });
    fireEvent.keyDown(searchInput, { key: "Enter" });

    expect(mockPush).toHaveBeenCalledWith("/search?q=query");
  });

  it("shows Settings link in footer", async () => {
    render(<Sidebar directories={[]} />);

    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    const settingsLink = screen.getByText("Settings");
    expect(settingsLink.closest("a")).toHaveAttribute("href", "/admin");
  });
});

// ---------------------------------------------------------------------------
// getExpandedNodes / saveExpandedNodes helpers
// ---------------------------------------------------------------------------

describe("getExpandedNodes / saveExpandedNodes", () => {
  beforeEach(() => {
    localStorage.removeItem("wikigit-expanded-nodes");
  });

  it("returns empty set when nothing stored", () => {
    const nodes = getExpandedNodes();
    expect(nodes.size).toBe(0);
  });

  it("round-trips a set of node paths", () => {
    const nodes = new Set(["docs", "docs/guides"]);
    saveExpandedNodes(nodes);

    const loaded = getExpandedNodes();
    expect(loaded.has("docs")).toBe(true);
    expect(loaded.has("docs/guides")).toBe(true);
    expect(loaded.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// TreeNode (imported separately)
// ---------------------------------------------------------------------------

import { TreeNode } from "@/components/layout/tree-node";

describe("TreeNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/");
    localStorage.removeItem("wikigit-expanded-nodes");
  });

  it("renders a file node with its name", () => {
    const node: DirectoryNode = {
      type: "file",
      name: "article.md",
      path: "article.md",
    };

    render(<TreeNode node={node} level={0} />);
    expect(screen.getByText("article.md")).toBeInTheDocument();
  });

  it("renders a directory node with its name", () => {
    const node: DirectoryNode = {
      type: "directory",
      name: "docs",
      path: "docs",
      children: [
        { type: "file", name: "intro.md", path: "docs/intro.md" },
      ],
    };

    render(<TreeNode node={node} level={0} />);
    expect(screen.getByText("docs")).toBeInTheDocument();
  });

  it("shows children when directory is expanded", async () => {
    // Pre-set the expanded state
    saveExpandedNodes(new Set(["docs"]));

    const node: DirectoryNode = {
      type: "directory",
      name: "docs",
      path: "docs",
      children: [
        { type: "file", name: "intro.md", path: "docs/intro.md" },
      ],
    };

    render(<TreeNode node={node} level={0} />);

    await waitFor(() => {
      expect(screen.getByText("intro.md")).toBeInTheDocument();
    });
  });

  it("does not show children when directory is collapsed", () => {
    const node: DirectoryNode = {
      type: "directory",
      name: "docs",
      path: "docs",
      children: [
        { type: "file", name: "intro.md", path: "docs/intro.md" },
      ],
    };

    render(<TreeNode node={node} level={0} />);
    expect(screen.queryByText("intro.md")).not.toBeInTheDocument();
  });

  it("shows context menu items for a file node", () => {
    const node: DirectoryNode = {
      type: "file",
      name: "article.md",
      path: "article.md",
    };

    render(<TreeNode node={node} level={0} />);

    // Because we mocked ContextMenu to render children directly,
    // the context menu items should be visible
    expect(screen.getByText("Rename")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("shows context menu items for a directory node", () => {
    const node: DirectoryNode = {
      type: "directory",
      name: "docs",
      path: "docs",
      children: [],
    };

    render(<TreeNode node={node} level={0} />);

    expect(screen.getByText("New Article")).toBeInTheDocument();
    expect(screen.getByText("New Folder")).toBeInTheDocument();
    expect(screen.getByText("Rename")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("disables context menu items when read-only", () => {
    const node: DirectoryNode = {
      type: "directory",
      name: "docs",
      path: "docs",
      children: [],
    };

    render(<TreeNode node={node} level={0} isReadOnly />);

    const newArticleButton = screen.getByText("New Article").closest("button");
    expect(newArticleButton).toBeDisabled();

    const renameButton = screen.getByText("Rename").closest("button");
    expect(renameButton).toBeDisabled();

    // The "This repository is read-only" message should be shown
    expect(
      screen.getByText("This repository is read-only"),
    ).toBeInTheDocument();
  });

  it("renders correct link href for file nodes", () => {
    const node: DirectoryNode = {
      type: "file",
      name: "article.md",
      path: "docs/article.md",
    };

    render(<TreeNode node={node} level={0} />);

    const link = screen.getByText("article.md").closest("a");
    expect(link).toHaveAttribute("href", "/docs/article.md");
  });

  it("renders correct link href with repositoryId", () => {
    const node: DirectoryNode = {
      type: "file",
      name: "article.md",
      path: "docs/article.md",
    };

    render(
      <TreeNode node={node} level={0} repositoryId="my-repo" />,
    );

    const link = screen.getByText("article.md").closest("a");
    expect(link).toHaveAttribute("href", "/my-repo/docs/article.md");
  });
});

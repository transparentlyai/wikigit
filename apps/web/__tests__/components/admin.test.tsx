import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockToast, mockApi } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockApi: {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    listRepositories: vi.fn(),
    syncRepository: vi.fn(),
    removeRepository: vi.fn(),
    updateRepository: vi.fn(),
    getGitHubSettings: vi.fn(),
    testGitHubConnection: vi.fn(),
    saveGitHubSettings: vi.fn(),
    reindexSearch: vi.fn(),
    getArticles: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({ default: mockToast }));
vi.mock("@/lib/api", () => ({ api: mockApi }));

// Mock zustand store -- RepositoryList uses useWikiStore
vi.mock("@/lib/store", () => ({
  useWikiStore: vi.fn((selector) =>
    selector({
      triggerRepositoryRefresh: vi.fn(),
      repositoryRefreshTrigger: 0,
      appName: "WikiGit",
    }),
  ),
  useStore: vi.fn((selector) =>
    selector({
      triggerRepositoryRefresh: vi.fn(),
      repositoryRefreshTrigger: 0,
      appName: "WikiGit",
    }),
  ),
}));

// Mock Radix AlertDialog for ConfirmDialog (portals are tricky in jsdom)
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

// Mock Radix Dialog for SearchManager's ConfirmDialog
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

// Mock lucide-react icons used across all admin components and their children
vi.mock("lucide-react", () => {
  const icon = (name: string) => {
    const C = () => <span data-testid={`icon-${name.toLowerCase()}`} />;
    C.displayName = name;
    return C;
  };
  return {
    Settings: icon("Settings"),
    Save: icon("Save"),
    RefreshCw: icon("RefreshCw"),
    Database: icon("Database"),
    Search: icon("Search"),
    TestTube2: icon("TestTube2"),
    Home: icon("Home"),
    GitBranch: icon("GitBranch"),
    Trash2: icon("Trash2"),
    Lock: icon("Lock"),
    Globe: icon("Globe"),
    Download: icon("Download"),
    Folder: icon("Folder"),
    Plus: icon("Plus"),
    AlertTriangle: icon("AlertTriangle"),
    CheckCircle: icon("CheckCircle"),
    XCircle: icon("XCircle"),
    Clock: icon("Clock"),
    AlertCircle: icon("AlertCircle"),
  };
});

import { ConfigManager } from "@/components/admin/config-manager";
import { RepositoryList } from "@/components/admin/repositories/repository-list";
import { GitHubSettings } from "@/components/admin/repositories/github-settings";
import { SearchManager } from "@/components/admin/search-manager";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockConfig = {
  app_name: "My Wiki",
  admins: ["admin@example.com"],
  index_dir: "/data/index",
  auto_sync_interval_minutes: 15,
  author_name: "Wiki Bot",
  author_email: "bot@example.com",
  default_branch: "main",
  repositories_root_dir: "/data/repos",
  home_page_repository: null,
  home_page_article: null,
};

const mockRepositories = {
  repositories: [
    {
      id: "repo-1",
      name: "My Wiki Pages",
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
    {
      id: "repo-2",
      name: "Docs",
      owner: "org",
      remote_url: "https://github.com/org/docs.git",
      enabled: true,
      read_only: true,
      default_branch: "main",
      last_synced: null,
      sync_status: "never" as const,
      error_message: null,
      local_path: "/data/repos/docs",
      has_local_changes: false,
      ahead_of_remote: 0,
      behind_of_remote: 0,
    },
  ],
  total: 2,
};

// ---------------------------------------------------------------------------
// ConfigManager
// ---------------------------------------------------------------------------

describe("ConfigManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // HomePageSelector also calls listRepositories on mount
    mockApi.listRepositories.mockResolvedValue({ repositories: [], total: 0 });
  });

  it("shows loading state initially", () => {
    // Never resolve the promise so it stays loading
    mockApi.getConfig.mockReturnValue(new Promise(() => {}));

    render(<ConfigManager />);
    expect(screen.getByText("Loading configuration...")).toBeInTheDocument();
  });

  it("renders the config form after loading", async () => {
    mockApi.getConfig.mockResolvedValue(mockConfig);

    render(<ConfigManager />);

    await waitFor(() => {
      expect(screen.getByText("Configuration Settings")).toBeInTheDocument();
    });

    // Check that the form inputs are populated
    const appNameInput = screen.getByLabelText("Application Name");
    expect(appNameInput).toHaveValue("My Wiki");

    const adminsTextarea = screen.getByLabelText(
      /Admin Users/,
    );
    expect(adminsTextarea).toHaveValue("admin@example.com");
  });

  it("saves updated config on submit", async () => {
    mockApi.getConfig.mockResolvedValue(mockConfig);
    mockApi.updateConfig.mockResolvedValue({
      ...mockConfig,
      app_name: "Updated Wiki",
    });

    render(<ConfigManager />);

    await waitFor(() => {
      expect(screen.getByLabelText("Application Name")).toBeInTheDocument();
    });

    // Change the app name
    const appNameInput = screen.getByLabelText("Application Name");
    fireEvent.change(appNameInput, { target: { value: "Updated Wiki" } });

    // Submit the form
    const saveButton = screen.getByText("Save Configuration");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockApi.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          app: expect.objectContaining({ name: "Updated Wiki" }),
        }),
      );
    });

    expect(mockToast.success).toHaveBeenCalledWith(
      "Configuration saved successfully",
    );
  });

  it("shows error toast when save fails", async () => {
    mockApi.getConfig.mockResolvedValue(mockConfig);
    mockApi.updateConfig.mockRejectedValue(
      new Error("Permission denied"),
    );

    render(<ConfigManager />);

    await waitFor(() => {
      expect(screen.getByLabelText("Application Name")).toBeInTheDocument();
    });

    const saveButton = screen.getByText("Save Configuration");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Permission denied");
    });
  });

  it("resets form values to original config on Reset click", async () => {
    mockApi.getConfig.mockResolvedValue(mockConfig);

    render(<ConfigManager />);

    await waitFor(() => {
      expect(screen.getByLabelText("Application Name")).toBeInTheDocument();
    });

    const appNameInput = screen.getByLabelText("Application Name");
    fireEvent.change(appNameInput, { target: { value: "Changed Name" } });
    expect(appNameInput).toHaveValue("Changed Name");

    const resetButton = screen.getByText("Reset");
    fireEvent.click(resetButton);

    expect(appNameInput).toHaveValue("My Wiki");
  });
});

// ---------------------------------------------------------------------------
// RepositoryList
// ---------------------------------------------------------------------------

describe("RepositoryList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    mockApi.listRepositories.mockReturnValue(new Promise(() => {}));

    render(<RepositoryList />);
    expect(screen.getByText("Loading repositories...")).toBeInTheDocument();
  });

  it("renders list of repositories after fetch", async () => {
    mockApi.listRepositories.mockResolvedValue(mockRepositories);

    render(<RepositoryList />);

    await waitFor(() => {
      expect(screen.getByText("Active Repositories")).toBeInTheDocument();
    });

    // The RepositoryCard children will be rendered; since we don't mock
    // RepositoryCard, we check that listRepositories was called
    expect(mockApi.listRepositories).toHaveBeenCalled();
  });

  it("shows empty state when no repositories exist", async () => {
    mockApi.listRepositories.mockResolvedValue({
      repositories: [],
      total: 0,
    });

    render(<RepositoryList />);

    await waitFor(() => {
      expect(
        screen.getByText(/No repositories configured/),
      ).toBeInTheDocument();
    });
  });

  it("refresh button triggers a new fetch", async () => {
    mockApi.listRepositories.mockResolvedValue(mockRepositories);

    render(<RepositoryList />);

    await waitFor(() => {
      expect(screen.getByText("Active Repositories")).toBeInTheDocument();
    });

    // Clear and set up again to track the next call
    mockApi.listRepositories.mockClear();
    mockApi.listRepositories.mockResolvedValue(mockRepositories);

    const refreshButton = screen.getByText("Refresh");
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockApi.listRepositories).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------------------------------------------------------------------------
// GitHubSettings
// ---------------------------------------------------------------------------

describe("GitHubSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders settings form after loading", async () => {
    mockApi.getGitHubSettings.mockResolvedValue({
      user_id: "my-github-user",
      token_env_var: "GITHUB_TOKEN",
    });

    render(<GitHubSettings />);

    await waitFor(() => {
      expect(screen.getByLabelText("GitHub User ID")).toBeInTheDocument();
    });

    const userIdInput = screen.getByLabelText("GitHub User ID");
    expect(userIdInput).toHaveValue("my-github-user");

    const tokenVarInput = screen.getByLabelText(
      "GitHub Token Environment Variable",
    );
    expect(tokenVarInput).toHaveValue("GITHUB_TOKEN");
  });

  it("test connection button calls API and shows success toast", async () => {
    mockApi.getGitHubSettings.mockResolvedValue({
      user_id: "my-user",
      token_env_var: "GITHUB_TOKEN",
    });
    mockApi.testGitHubConnection.mockResolvedValue({
      status: "ok",
      message: "Connected",
    });

    render(<GitHubSettings />);

    await waitFor(() => {
      expect(screen.getByLabelText("GitHub User ID")).toBeInTheDocument();
    });

    const testButton = screen.getByText("Test Connection");
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockApi.testGitHubConnection).toHaveBeenCalledWith({
        user_id: "my-user",
        token_var: "GITHUB_TOKEN",
      });
    });

    expect(mockToast.success).toHaveBeenCalledWith(
      "GitHub connection successful!",
    );
  });

  it("test connection shows error toast on failure", async () => {
    mockApi.getGitHubSettings.mockResolvedValue({
      user_id: "my-user",
      token_env_var: "GITHUB_TOKEN",
    });
    mockApi.testGitHubConnection.mockRejectedValue(
      new Error("Invalid token"),
    );

    render(<GitHubSettings />);

    await waitFor(() => {
      expect(screen.getByLabelText("GitHub User ID")).toBeInTheDocument();
    });

    const testButton = screen.getByText("Test Connection");
    fireEvent.click(testButton);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Invalid token");
    });
  });

  it("test connection shows error when user ID is empty", async () => {
    mockApi.getGitHubSettings.mockResolvedValue({
      user_id: "",
      token_env_var: "GITHUB_TOKEN",
    });

    render(<GitHubSettings />);

    await waitFor(() => {
      expect(screen.getByLabelText("GitHub User ID")).toBeInTheDocument();
    });

    const testButton = screen.getByText("Test Connection");
    fireEvent.click(testButton);

    expect(mockToast.error).toHaveBeenCalledWith(
      "Please enter a GitHub user ID",
    );
    expect(mockApi.testGitHubConnection).not.toHaveBeenCalled();
  });

  it("save button calls saveGitHubSettings API", async () => {
    mockApi.getGitHubSettings.mockResolvedValue({
      user_id: "my-user",
      token_env_var: "GITHUB_TOKEN",
    });
    mockApi.saveGitHubSettings.mockResolvedValue(undefined);

    render(<GitHubSettings />);

    await waitFor(() => {
      expect(screen.getByLabelText("GitHub User ID")).toBeInTheDocument();
    });

    const saveButton = screen.getByText("Save Settings");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockApi.saveGitHubSettings).toHaveBeenCalledWith({
        user_id: "my-user",
        token_var: "GITHUB_TOKEN",
      });
    });

    expect(mockToast.success).toHaveBeenCalledWith(
      "GitHub settings saved successfully",
    );
  });
});

// ---------------------------------------------------------------------------
// SearchManager
// ---------------------------------------------------------------------------

describe("SearchManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the reindex button", () => {
    render(<SearchManager />);

    expect(
      screen.getByText("Search Index Management"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Rebuild Search Index/ }),
    ).toBeInTheDocument();
  });

  it("reindex button opens confirmation and triggers reindexing on confirm", async () => {
    mockApi.reindexSearch.mockResolvedValue({
      status: "ok",
      document_count: 42,
      message: "Indexed 42 articles",
    });

    render(<SearchManager />);

    // Click the reindex button to open the confirmation dialog
    const reindexButton = screen.getByRole("button", {
      name: /Rebuild Search Index/,
    });
    fireEvent.click(reindexButton);

    // The ConfirmDialog should now be visible
    await waitFor(() => {
      expect(screen.getByText("Rebuild")).toBeInTheDocument();
    });

    // Click the Rebuild confirmation button
    const confirmButton = screen.getByText("Rebuild");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockApi.reindexSearch).toHaveBeenCalled();
    });

    expect(mockToast.success).toHaveBeenCalledWith(
      "Search index rebuilt successfully. Indexed 42 articles.",
    );
  });

  it("shows error toast when reindex fails", async () => {
    mockApi.reindexSearch.mockRejectedValue(
      new Error("Index corrupted"),
    );

    render(<SearchManager />);

    const reindexButton = screen.getByRole("button", {
      name: /Rebuild Search Index/,
    });
    fireEvent.click(reindexButton);

    await waitFor(() => {
      expect(screen.getByText("Rebuild")).toBeInTheDocument();
    });

    const confirmButton = screen.getByText("Rebuild");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Index corrupted");
    });
  });
});

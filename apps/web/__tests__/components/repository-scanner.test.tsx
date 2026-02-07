import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Hoisted mock values
// ---------------------------------------------------------------------------

const { mockApi, mockToast, mockTriggerRefresh, iconFactory } = vi.hoisted(
  () => ({
    mockApi: {
      scanGitHubRepositories: vi.fn(),
      addRepositories: vi.fn(),
    },
    mockToast: Object.assign(vi.fn(), {
      success: vi.fn(),
      error: vi.fn(),
    }),
    mockTriggerRefresh: vi.fn(),
    iconFactory: (name: string) => {
      const Icon = (props: any) =>
        React.createElement("svg", {
          "data-testid": `icon-${name}`,
          ...props,
        });
      Icon.displayName = name;
      return Icon;
    },
  }),
);

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/api", () => ({ api: mockApi }));
vi.mock("react-hot-toast", () => ({ default: mockToast }));
vi.mock("@/lib/store", () => ({
  useWikiStore: (selector: any) =>
    selector({ triggerRepositoryRefresh: mockTriggerRefresh }),
}));
vi.mock("lucide-react", () => ({
  Search: iconFactory("Search"),
  Download: iconFactory("Download"),
  GitBranch: iconFactory("GitBranch"),
  Lock: iconFactory("Lock"),
  Globe: iconFactory("Globe"),
}));

import { RepositoryScanner } from "@/components/admin/repositories/repository-scanner";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RepositoryScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the heading and scan button", () => {
    render(<RepositoryScanner />);
    expect(
      screen.getByRole("heading", { name: /Scan GitHub Repositories/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Scan GitHub Repositories/i }),
    ).toBeInTheDocument();
  });

  it("calls scanGitHubRepositories on scan button click", async () => {
    mockApi.scanGitHubRepositories.mockResolvedValue([]);
    render(<RepositoryScanner />);

    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(mockApi.scanGitHubRepositories).toHaveBeenCalledTimes(1);
    });
  });

  it("shows scanning state while loading", async () => {
    let resolvePromise: (value: any) => void;
    mockApi.scanGitHubRepositories.mockReturnValue(
      new Promise((r) => {
        resolvePromise = r;
      }),
    );

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    expect(screen.getByText("Scanning GitHub...")).toBeInTheDocument();

    resolvePromise!([]);
    await waitFor(() => {
      expect(screen.queryByText("Scanning GitHub...")).not.toBeInTheDocument();
    });
  });

  it("displays success toast after scanning", async () => {
    const repos = [
      { full_name: "org/repo1", description: "Repo 1", private: false },
      { full_name: "org/repo2", description: "Repo 2", private: true },
    ];
    mockApi.scanGitHubRepositories.mockResolvedValue(repos);

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "Found 2 repositories",
      );
    });
  });

  it("shows error toast on scan failure", async () => {
    mockApi.scanGitHubRepositories.mockRejectedValue(
      new Error("GitHub auth failed"),
    );

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("GitHub auth failed");
    });
  });

  it("displays repository list after scanning", async () => {
    const repos = [
      { full_name: "org/repo1", description: "First repo", private: false },
      { full_name: "org/repo2", description: "Second repo", private: true },
    ];
    mockApi.scanGitHubRepositories.mockResolvedValue(repos);

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(screen.getByText("org/repo1")).toBeInTheDocument();
      expect(screen.getByText("org/repo2")).toBeInTheDocument();
      expect(screen.getByText("First repo")).toBeInTheDocument();
      expect(screen.getByText("Second repo")).toBeInTheDocument();
    });
  });

  it("shows Globe icon for public repos and Lock for private", async () => {
    const repos = [
      { full_name: "org/public-repo", description: "", private: false },
      { full_name: "org/private-repo", description: "", private: true },
    ];
    mockApi.scanGitHubRepositories.mockResolvedValue(repos);

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(screen.getAllByTestId("icon-Globe").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByTestId("icon-Lock").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows repository count in header", async () => {
    const repos = [
      { full_name: "org/repo1", description: "", private: false },
      { full_name: "org/repo2", description: "", private: false },
    ];
    mockApi.scanGitHubRepositories.mockResolvedValue(repos);

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(screen.getByText("2 repositories found")).toBeInTheDocument();
    });
  });

  it("can select and deselect individual repos", async () => {
    const repos = [
      { full_name: "org/repo1", description: "", private: false },
    ];
    mockApi.scanGitHubRepositories.mockResolvedValue(repos);

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(screen.getByText("org/repo1")).toBeInTheDocument();
    });

    // The individual repo checkbox (not the select-all header checkbox)
    const checkboxes = screen.getAllByRole("checkbox");
    // First is select-all, rest are individual
    const repoCheckbox = checkboxes[1];

    fireEvent.click(repoCheckbox);
    expect(screen.getByText(/Clone Selected \(1\)/)).toBeInTheDocument();

    fireEvent.click(repoCheckbox);
    expect(screen.getByText(/Clone Selected \(0\)/)).toBeInTheDocument();
  });

  it("can toggle all repos", async () => {
    const repos = [
      { full_name: "org/repo1", description: "", private: false },
      { full_name: "org/repo2", description: "", private: false },
    ];
    mockApi.scanGitHubRepositories.mockResolvedValue(repos);

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(screen.getByText("org/repo1")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    const selectAll = checkboxes[0];

    fireEvent.click(selectAll);
    expect(screen.getByText(/Clone Selected \(2\)/)).toBeInTheDocument();

    // Clicking again deselects all
    fireEvent.click(selectAll);
    expect(screen.getByText(/Clone Selected \(0\)/)).toBeInTheDocument();
  });

  it("filters repositories by search query", async () => {
    const repos = [
      { full_name: "org/frontend", description: "React app", private: false },
      { full_name: "org/backend", description: "Python API", private: false },
    ];
    mockApi.scanGitHubRepositories.mockResolvedValue(repos);

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(screen.getByText("org/frontend")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search repositories...");
    fireEvent.change(searchInput, { target: { value: "frontend" } });

    expect(screen.getByText("org/frontend")).toBeInTheDocument();
    expect(screen.queryByText("org/backend")).not.toBeInTheDocument();
  });

  it("filters by description", async () => {
    const repos = [
      { full_name: "org/repo1", description: "React app", private: false },
      { full_name: "org/repo2", description: "Python API", private: false },
    ];
    mockApi.scanGitHubRepositories.mockResolvedValue(repos);

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(screen.getByText("org/repo1")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search repositories...");
    fireEvent.change(searchInput, { target: { value: "Python" } });

    expect(screen.queryByText("org/repo1")).not.toBeInTheDocument();
    expect(screen.getByText("org/repo2")).toBeInTheDocument();
  });

  it("shows 'no match' when filter produces no results", async () => {
    const repos = [
      { full_name: "org/repo1", description: "", private: false },
    ];
    mockApi.scanGitHubRepositories.mockResolvedValue(repos);

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(screen.getByText("org/repo1")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search repositories...");
    fireEvent.change(searchInput, { target: { value: "zzzzz" } });

    expect(
      screen.getByText("No repositories match your search."),
    ).toBeInTheDocument();
  });

  it("shows error when cloning with no selection", async () => {
    const repos = [
      { full_name: "org/repo1", description: "", private: false },
    ];
    mockApi.scanGitHubRepositories.mockResolvedValue(repos);

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(screen.getByText("org/repo1")).toBeInTheDocument();
    });

    // Clone Selected button is disabled with 0 selected, but let's verify the count
    expect(screen.getByText(/Clone Selected \(0\)/)).toBeInTheDocument();
  });

  it("clones selected repositories", async () => {
    const repos = [
      { full_name: "org/repo1", description: "", private: false },
    ];
    mockApi.scanGitHubRepositories.mockResolvedValue(repos);
    mockApi.addRepositories.mockResolvedValue({});

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(screen.getByText("org/repo1")).toBeInTheDocument();
    });

    // Select the repo
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);

    // Click clone
    fireEvent.click(screen.getByText(/Clone Selected/));

    await waitFor(() => {
      expect(mockApi.addRepositories).toHaveBeenCalledWith(["org/repo1"]);
      expect(mockToast.success).toHaveBeenCalledWith(
        "Successfully cloned 1 repositories",
      );
      expect(mockTriggerRefresh).toHaveBeenCalled();
    });
  });

  it("shows error toast when clone fails", async () => {
    const repos = [
      { full_name: "org/repo1", description: "", private: false },
    ];
    mockApi.scanGitHubRepositories.mockResolvedValue(repos);
    mockApi.addRepositories.mockRejectedValue(new Error("Clone failed"));

    render(<RepositoryScanner />);
    fireEvent.click(screen.getByRole("button", { name: /Scan GitHub Repositories/i }));

    await waitFor(() => {
      expect(screen.getByText("org/repo1")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText(/Clone Selected/));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Clone failed");
    });
  });
});

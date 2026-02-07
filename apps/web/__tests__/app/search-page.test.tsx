import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Hoisted mock values
// ---------------------------------------------------------------------------

const { mockApi, mockToast, mockRouter, mockSearchParams, iconFactory } =
  vi.hoisted(() => ({
    mockApi: {
      listRepositories: vi.fn(),
      search: vi.fn(),
    },
    mockToast: Object.assign(vi.fn(), {
      success: vi.fn(),
      error: vi.fn(),
    }),
    mockRouter: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
    mockSearchParams: {
      get: vi.fn().mockReturnValue(null),
      toString: vi.fn().mockReturnValue(""),
    },
    iconFactory: (name: string) => {
      const Icon = (props: any) =>
        React.createElement("svg", {
          "data-testid": `icon-${name}`,
          ...props,
        });
      Icon.displayName = name;
      return Icon;
    },
  }));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/api", () => ({ api: mockApi }));
vi.mock("react-hot-toast", () => ({ default: mockToast }));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/components/layout/main-layout", () => ({
  MainLayout: ({ children }: any) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: any) => <div data-testid="markdown">{children}</div>,
}));

vi.mock("remark-gfm", () => ({ default: {} }));

vi.mock("lucide-react", () => ({
  Search: iconFactory("Search"),
  FileText: iconFactory("FileText"),
  ChevronRight: iconFactory("ChevronRight"),
}));

import SearchPage from "@/app/search/page";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SearchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.get.mockReturnValue(null);
    mockSearchParams.toString.mockReturnValue("");
    mockApi.listRepositories.mockResolvedValue({
      repositories: [],
    });
    mockApi.search.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders inside MainLayout", async () => {
    await act(async () => {
      render(<SearchPage />);
    });
    expect(screen.getByTestId("main-layout")).toBeInTheDocument();
  });

  it("renders the search input", async () => {
    await act(async () => {
      render(<SearchPage />);
    });
    expect(
      screen.getByPlaceholderText("Search documentation..."),
    ).toBeInTheDocument();
  });

  it("shows initial empty state when no query", async () => {
    await act(async () => {
      render(<SearchPage />);
    });
    expect(
      screen.getByText("Enter a search query above to find articles."),
    ).toBeInTheDocument();
  });

  it("shows search help text", async () => {
    await act(async () => {
      render(<SearchPage />);
    });
    expect(
      screen.getByText(
        "Search indexes Markdown content and filenames of other files.",
      ),
    ).toBeInTheDocument();
  });

  it("fetches repositories on mount", async () => {
    await act(async () => {
      render(<SearchPage />);
    });
    expect(mockApi.listRepositories).toHaveBeenCalled();
  });

  it("performs search when URL has query parameter", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "q") return "test query";
      if (key === "repo") return null;
      return null;
    });
    mockSearchParams.toString.mockReturnValue("q=test+query");

    mockApi.search.mockResolvedValue([
      {
        repository_id: "repo1",
        repository_name: "Repo 1",
        path: "docs/guide.md",
        title: "Guide",
        snippet: "A test guide",
        score: 0.95,
      },
    ]);

    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() => {
      expect(mockApi.search).toHaveBeenCalledWith("test query", undefined);
    });
  });

  it("displays search results with title and breadcrumbs", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "q") return "test";
      if (key === "repo") return null;
      return null;
    });
    mockSearchParams.toString.mockReturnValue("q=test");

    mockApi.search.mockResolvedValue([
      {
        repository_id: "repo1",
        repository_name: "Repo 1",
        path: "docs/guide.md",
        title: "Test Guide",
        snippet: "Some snippet content",
        score: 0.85,
      },
    ]);

    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("Test Guide")).toBeInTheDocument();
    });

    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.getByText("guide.md")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("shows result count after search", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "q") return "test";
      return null;
    });
    mockSearchParams.toString.mockReturnValue("q=test");

    mockApi.search.mockResolvedValue([
      {
        repository_id: "repo1",
        repository_name: "Repo 1",
        path: "Home.md",
        title: "Home",
        snippet: "Welcome",
        score: 0.9,
      },
    ]);

    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() => {
      // "Found 1 result for" rendered as multiple spans
      const text = screen.getByText(/1 result/);
      expect(text).toBeInTheDocument();
    });
  });

  it("shows no results message when search returns empty", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "q") return "nonexistent";
      return null;
    });
    mockSearchParams.toString.mockReturnValue("q=nonexistent");

    mockApi.search.mockResolvedValue([]);

    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("No articles found")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Try different keywords or check your spelling."),
    ).toBeInTheDocument();
  });

  it("shows toast error on search failure", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "q") return "fail";
      return null;
    });
    mockSearchParams.toString.mockReturnValue("q=fail");

    mockApi.search.mockRejectedValue(new Error("Network error"));

    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Network error");
    });
  });

  it("navigates to article on result click", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "q") return "test";
      return null;
    });
    mockSearchParams.toString.mockReturnValue("q=test");

    mockApi.search.mockResolvedValue([
      {
        repository_id: "repo1",
        repository_name: "Repo 1",
        path: "docs/guide.md",
        title: "Guide",
        snippet: "content",
        score: 0.9,
      },
    ]);

    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("Guide")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Guide"));
    expect(mockRouter.push).toHaveBeenCalledWith("/repo1/docs/guide.md");
  });

  it("shows repository filter when multiple repos available", async () => {
    mockApi.listRepositories.mockResolvedValue({
      repositories: [
        { id: "repo1", name: "Repo One", enabled: true },
        { id: "repo2", name: "Repo Two", enabled: true },
      ],
    });

    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("All repositories")).toBeInTheDocument();
    });
    expect(screen.getByText("Repo One")).toBeInTheDocument();
    expect(screen.getByText("Repo Two")).toBeInTheDocument();
  });

  it("hides repository filter with single repo", async () => {
    mockApi.listRepositories.mockResolvedValue({
      repositories: [{ id: "repo1", name: "Repo One", enabled: true }],
    });

    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() => {
      expect(mockApi.listRepositories).toHaveBeenCalled();
    });
    expect(screen.queryByText("All repositories")).not.toBeInTheDocument();
  });

  it("filters out disabled repositories", async () => {
    mockApi.listRepositories.mockResolvedValue({
      repositories: [
        { id: "repo1", name: "Enabled", enabled: true },
        { id: "repo2", name: "Disabled", enabled: false },
        { id: "repo3", name: "Also Enabled", enabled: true },
      ],
    });

    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("All repositories")).toBeInTheDocument();
    });
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Also Enabled")).toBeInTheDocument();
    expect(screen.queryByText("Disabled")).not.toBeInTheDocument();
  });

  it("renders snippet through ReactMarkdown", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "q") return "test";
      return null;
    });
    mockSearchParams.toString.mockReturnValue("q=test");

    mockApi.search.mockResolvedValue([
      {
        repository_id: "repo1",
        repository_name: "Repo 1",
        path: "Home.md",
        title: "Home",
        snippet: "Some **bold** content",
        score: 0.9,
      },
    ]);

    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("markdown")).toBeInTheDocument();
    });
  });

  it("applies correct relevance badge colors", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "q") return "test";
      return null;
    });
    mockSearchParams.toString.mockReturnValue("q=test");

    mockApi.search.mockResolvedValue([
      { repository_id: "r1", repository_name: "R", path: "high.md", title: "High", snippet: "", score: 0.95 },
      { repository_id: "r1", repository_name: "R", path: "med.md", title: "Med", snippet: "", score: 0.75 },
      { repository_id: "r1", repository_name: "R", path: "low.md", title: "Low", snippet: "", score: 0.5 },
    ]);

    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("95%")).toBeInTheDocument();
    });

    expect(screen.getByText("95%").className).toContain("bg-green-100");
    expect(screen.getByText("75%").className).toContain("bg-blue-50");
    expect(screen.getByText("50%").className).toContain("bg-gray-100");
  });

  it("updates input value on typing", async () => {
    await act(async () => {
      render(<SearchPage />);
    });

    const input = screen.getByPlaceholderText("Search documentation...");
    await act(async () => {
      fireEvent.change(input, { target: { value: "new query" } });
    });
    expect(input).toHaveValue("new query");
  });

  it("searches with repo filter from URL", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "q") return "test";
      if (key === "repo") return "repo1";
      return null;
    });
    mockSearchParams.toString.mockReturnValue("q=test&repo=repo1");

    mockApi.search.mockResolvedValue([]);

    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() => {
      expect(mockApi.search).toHaveBeenCalledWith("test", "repo1");
    });
  });

  it("constructs article URL without repository_id when empty", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "q") return "test";
      return null;
    });
    mockSearchParams.toString.mockReturnValue("q=test");

    mockApi.search.mockResolvedValue([
      { repository_id: "", repository_name: "", path: "Home.md", title: "Home", snippet: "", score: 0.9 },
    ]);

    await act(async () => {
      render(<SearchPage />);
    });

    await waitFor(() => {
      expect(screen.getByText("Home")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Home"));
    expect(mockRouter.push).toHaveBeenCalledWith("/Home.md");
  });

  it("handles listRepositories failure gracefully", async () => {
    mockApi.listRepositories.mockRejectedValue(new Error("API down"));

    await act(async () => {
      render(<SearchPage />);
    });

    expect(
      screen.getByPlaceholderText("Search documentation..."),
    ).toBeInTheDocument();
  });
});

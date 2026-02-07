import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockRouter, mockToast } = vi.hoisted(() => ({
  mockRouter: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  mockToast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("react-hot-toast", () => ({ default: mockToast }));

// Mock MainLayout to just render children
vi.mock("@/components/layout/main-layout", () => ({
  MainLayout: ({ children }: any) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

// Mock MarkdownEditor
vi.mock("@/components/editor/markdown-editor", () => ({
  MarkdownEditor: ({ value, onChange, onSave, onCancel }: any) => (
    <div data-testid="markdown-editor">
      <textarea
        data-testid="editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button data-testid="editor-save" onClick={onSave}>
        Save
      </button>
      <button data-testid="editor-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

import NewArticlePage from "@/app/new/page";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NewArticlePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  it("renders the form with path input and editor", () => {
    render(<NewArticlePage />);

    expect(screen.getByText("Article Path")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        "e.g., Getting-Started.md or docs/API-Guide.md",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("markdown-editor")).toBeInTheDocument();
  });

  it("shows initial content in the editor", () => {
    render(<NewArticlePage />);

    const textarea = screen.getByTestId(
      "editor-textarea",
    ) as HTMLTextAreaElement;
    expect(textarea.value).toContain("# New Article");
  });

  it("updates path input value on change", () => {
    render(<NewArticlePage />);

    const input = screen.getByPlaceholderText(
      "e.g., Getting-Started.md or docs/API-Guide.md",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "docs/my-article.md" } });
    expect(input.value).toBe("docs/my-article.md");
  });

  it("shows error toast when saving without a path", async () => {
    render(<NewArticlePage />);

    fireEvent.click(screen.getByTestId("editor-save"));

    expect(mockToast.error).toHaveBeenCalledWith(
      "Please enter a path for the article",
    );
  });

  it("shows error toast when path is only whitespace", async () => {
    render(<NewArticlePage />);

    const input = screen.getByPlaceholderText(
      "e.g., Getting-Started.md or docs/API-Guide.md",
    );
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByTestId("editor-save"));

    expect(mockToast.error).toHaveBeenCalledWith(
      "Please enter a path for the article",
    );
  });

  it("does not call fetch when path is empty", async () => {
    render(<NewArticlePage />);

    fireEvent.click(screen.getByTestId("editor-save"));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("creates article successfully and navigates", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    render(<NewArticlePage />);

    const input = screen.getByPlaceholderText(
      "e.g., Getting-Started.md or docs/API-Guide.md",
    );
    fireEvent.change(input, { target: { value: "docs/guide.md" } });
    fireEvent.click(screen.getByTestId("editor-save"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("docs/guide.md"),
      });
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "Article created successfully",
      );
    });

    expect(mockRouter.push).toHaveBeenCalledWith(
      "/article/docs%2Fguide.md",
    );
  });

  it("shows error toast when API returns error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Path already exists" }),
    });

    render(<NewArticlePage />);

    const input = screen.getByPlaceholderText(
      "e.g., Getting-Started.md or docs/API-Guide.md",
    );
    fireEvent.change(input, { target: { value: "existing.md" } });
    fireEvent.click(screen.getByTestId("editor-save"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Error creating article: Path already exists",
      );
    });
  });

  it("shows generic error toast when API returns error without detail", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    render(<NewArticlePage />);

    const input = screen.getByPlaceholderText(
      "e.g., Getting-Started.md or docs/API-Guide.md",
    );
    fireEvent.change(input, { target: { value: "test.md" } });
    fireEvent.click(screen.getByTestId("editor-save"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Error creating article: Unknown error",
      );
    });
  });

  it("shows error toast on network failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    render(<NewArticlePage />);

    const input = screen.getByPlaceholderText(
      "e.g., Getting-Started.md or docs/API-Guide.md",
    );
    fireEvent.change(input, { target: { value: "test.md" } });
    fireEvent.click(screen.getByTestId("editor-save"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Failed to create article",
      );
    });
  });

  it("navigates home on cancel", () => {
    render(<NewArticlePage />);

    fireEvent.click(screen.getByTestId("editor-cancel"));
    expect(mockRouter.push).toHaveBeenCalledWith("/");
  });

  it("sends correct request body with path, content, and message", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    render(<NewArticlePage />);

    const input = screen.getByPlaceholderText(
      "e.g., Getting-Started.md or docs/API-Guide.md",
    );
    fireEvent.change(input, { target: { value: "my-doc.md" } });
    fireEvent.click(screen.getByTestId("editor-save"));

    await waitFor(() => {
      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.path).toBe("my-doc.md");
      expect(body.message).toBe("Create my-doc.md");
      expect(body.content).toBeDefined();
    });
  });
});

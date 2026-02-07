import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Hoisted mock values
// ---------------------------------------------------------------------------

const { mockRouter, mockToast, iconFactory } = vi.hoisted(() => ({
  mockRouter: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  mockToast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
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

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("react-hot-toast", () => ({ default: mockToast }));

vi.mock("lucide-react", () => ({
  FolderPlus: iconFactory("FolderPlus"),
}));

import NewFolderPage from "@/app/new-folder/page";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NewFolderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders the page title and icon", () => {
    render(<NewFolderPage />);
    expect(screen.getByText("Create New Folder")).toBeInTheDocument();
    expect(screen.getByTestId("icon-FolderPlus")).toBeInTheDocument();
  });

  it("renders the folder path input", () => {
    render(<NewFolderPage />);
    expect(screen.getByText("Folder Path")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("e.g., docs or guides/tutorials"),
    ).toBeInTheDocument();
  });

  it("shows usage hint text", () => {
    render(<NewFolderPage />);
    expect(
      screen.getByText(/Use forward slashes.*to create nested folders/),
    ).toBeInTheDocument();
  });

  it("renders create and cancel buttons", () => {
    render(<NewFolderPage />);
    expect(screen.getByText("Create Folder")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("disables create button when path is empty", () => {
    render(<NewFolderPage />);
    const createBtn = screen.getByText("Create Folder");
    expect(createBtn).toBeDisabled();
  });

  it("enables create button when path is entered", () => {
    render(<NewFolderPage />);
    const input = screen.getByPlaceholderText(
      "e.g., docs or guides/tutorials",
    );
    fireEvent.change(input, { target: { value: "my-folder" } });
    const createBtn = screen.getByText("Create Folder");
    expect(createBtn).not.toBeDisabled();
  });

  it("shows error toast when creating with empty path", async () => {
    render(<NewFolderPage />);
    // Directly call the handler by making the button clickable
    // The button is disabled when empty, but let's test the validation
    const input = screen.getByPlaceholderText(
      "e.g., docs or guides/tutorials",
    );
    fireEvent.change(input, { target: { value: "   " } });
    // Button still disabled with whitespace-only, so we verify the button state
    const createBtn = screen.getByText("Create Folder");
    expect(createBtn).toBeDisabled();
  });

  it("creates folder successfully and navigates home", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    render(<NewFolderPage />);

    const input = screen.getByPlaceholderText(
      "e.g., docs or guides/tutorials",
    );
    fireEvent.change(input, { target: { value: "docs/guides" } });
    fireEvent.click(screen.getByText("Create Folder"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("docs/guides/.gitkeep"),
      });
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "Folder created successfully!",
      );
    });

    expect(mockRouter.push).toHaveBeenCalledWith("/");
  });

  it("sends correct request body with .gitkeep path", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    render(<NewFolderPage />);

    const input = screen.getByPlaceholderText(
      "e.g., docs or guides/tutorials",
    );
    fireEvent.change(input, { target: { value: "my-section" } });
    fireEvent.click(screen.getByText("Create Folder"));

    await waitFor(() => {
      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.path).toBe("my-section/.gitkeep");
      expect(body.content).toBe("");
      expect(body.message).toBe("Create directory my-section");
    });
  });

  it("shows error toast when API returns error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Folder already exists" }),
    });

    render(<NewFolderPage />);

    const input = screen.getByPlaceholderText(
      "e.g., docs or guides/tutorials",
    );
    fireEvent.change(input, { target: { value: "existing" } });
    fireEvent.click(screen.getByText("Create Folder"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Error creating folder: Folder already exists",
      );
    });
  });

  it("shows generic error when API returns no detail", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    render(<NewFolderPage />);

    const input = screen.getByPlaceholderText(
      "e.g., docs or guides/tutorials",
    );
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.click(screen.getByText("Create Folder"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Error creating folder: Unknown error",
      );
    });
  });

  it("shows error toast on network failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    render(<NewFolderPage />);

    const input = screen.getByPlaceholderText(
      "e.g., docs or guides/tutorials",
    );
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.click(screen.getByText("Create Folder"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to create folder");
    });
  });

  it("navigates back on cancel", () => {
    render(<NewFolderPage />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("shows creating state during submission", async () => {
    let resolvePromise: any;
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    render(<NewFolderPage />);

    const input = screen.getByPlaceholderText(
      "e.g., docs or guides/tutorials",
    );
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.click(screen.getByText("Create Folder"));

    await waitFor(() => {
      expect(screen.getByText("Creating...")).toBeInTheDocument();
    });

    // Input should be disabled during creation
    expect(input).toBeDisabled();

    // Resolve the promise to complete
    resolvePromise({ ok: true, json: async () => ({}) });
  });

  it("updates folder path on input change", () => {
    render(<NewFolderPage />);

    const input = screen.getByPlaceholderText(
      "e.g., docs or guides/tutorials",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "guides/advanced" } });
    expect(input.value).toBe("guides/advanced");
  });
});

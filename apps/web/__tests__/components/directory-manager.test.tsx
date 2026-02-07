import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Hoisted mock values
// ---------------------------------------------------------------------------

const { mockApi, mockToast, iconFactory } = vi.hoisted(() => ({
  mockApi: {
    createDirectory: vi.fn(),
    deleteDirectory: vi.fn(),
  },
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

vi.mock("@/lib/api", () => ({ api: mockApi }));
vi.mock("react-hot-toast", () => ({ default: mockToast }));
vi.mock("lucide-react", () => ({
  Folder: iconFactory("Folder"),
  Plus: iconFactory("Plus"),
  Trash2: iconFactory("Trash2"),
}));
vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    description,
    onConfirm,
    onOpenChange,
  }: any) =>
    open ? (
      <div data-testid="confirm-dialog">
        <div>{title}</div>
        <div>{description}</div>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={() => onOpenChange(false)}>Cancel</button>
      </div>
    ) : null,
}));

import { DirectoryManager } from "@/components/admin/directory-manager";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DirectoryManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the heading", () => {
    render(<DirectoryManager />);
    expect(screen.getByText("Directory Management")).toBeInTheDocument();
  });

  it("renders create and delete sections", () => {
    render(<DirectoryManager />);
    expect(
      screen.getByRole("heading", { name: /Create Directory/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Delete Directory/i }),
    ).toBeInTheDocument();
  });

  it("renders about directories info section", () => {
    render(<DirectoryManager />);
    expect(screen.getByText("About Directories")).toBeInTheDocument();
  });

  it("has inputs for directory paths", () => {
    render(<DirectoryManager />);
    expect(screen.getAllByLabelText(/Directory Path/).length).toBe(2);
  });

  // --- Create directory tests ---

  it("creates a directory on form submit", async () => {
    mockApi.createDirectory.mockResolvedValue({});

    render(<DirectoryManager />);
    const input = screen.getByLabelText("Directory Path", {
      selector: "#new-dir-path",
    });
    fireEvent.change(input, { target: { value: "docs/tutorials" } });

    const createBtn = screen.getByRole("button", { name: /Create Directory/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mockApi.createDirectory).toHaveBeenCalledWith("docs/tutorials");
      expect(mockToast.success).toHaveBeenCalledWith(
        "Directory created: docs/tutorials",
      );
    });
  });

  it("shows error toast when create fails", async () => {
    mockApi.createDirectory.mockRejectedValue(new Error("Already exists"));

    render(<DirectoryManager />);
    const input = screen.getByLabelText("Directory Path", {
      selector: "#new-dir-path",
    });
    fireEvent.change(input, { target: { value: "docs" } });

    const createBtn = screen.getByRole("button", { name: /Create Directory/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Already exists");
    });
  });

  it("shows error for empty directory path on create", async () => {
    render(<DirectoryManager />);
    const input = screen.getByLabelText("Directory Path", {
      selector: "#new-dir-path",
    });
    fireEvent.change(input, { target: { value: "   " } });

    const createBtn = screen.getByRole("button", { name: /Create Directory/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Directory path is required",
      );
    });
    expect(mockApi.createDirectory).not.toHaveBeenCalled();
  });

  it("clears input after successful creation", async () => {
    mockApi.createDirectory.mockResolvedValue({});

    render(<DirectoryManager />);
    const input = screen.getByLabelText("Directory Path", {
      selector: "#new-dir-path",
    }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "docs/new" } });

    const createBtn = screen.getByRole("button", { name: /Create Directory/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });

  it("shows creating state", async () => {
    let resolvePromise: (value: any) => void;
    mockApi.createDirectory.mockReturnValue(
      new Promise((r) => {
        resolvePromise = r;
      }),
    );

    render(<DirectoryManager />);
    const input = screen.getByLabelText("Directory Path", {
      selector: "#new-dir-path",
    });
    fireEvent.change(input, { target: { value: "docs" } });

    const createBtn = screen.getByRole("button", { name: /Create Directory/i });
    fireEvent.click(createBtn);

    expect(screen.getByText("Creating...")).toBeInTheDocument();

    resolvePromise!({});
    await waitFor(() => {
      expect(screen.queryByText("Creating...")).not.toBeInTheDocument();
    });
  });

  // --- Delete directory tests ---

  it("opens confirm dialog when deleting", async () => {
    render(<DirectoryManager />);
    const input = screen.getByLabelText("Directory Path", {
      selector: "#delete-dir-path",
    });
    fireEvent.change(input, { target: { value: "old-docs" } });

    const deleteBtn = screen.getByRole("button", { name: /Delete Directory/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
  });

  it("shows error for empty path on delete submit", async () => {
    render(<DirectoryManager />);
    const input = screen.getByLabelText("Directory Path", {
      selector: "#delete-dir-path",
    });
    fireEvent.change(input, { target: { value: "   " } });

    const deleteBtn = screen.getByRole("button", { name: /Delete Directory/i });
    fireEvent.click(deleteBtn);

    expect(mockToast.error).toHaveBeenCalledWith(
      "Directory path is required",
    );
  });

  it("deletes directory after confirmation", async () => {
    mockApi.deleteDirectory.mockResolvedValue({});

    render(<DirectoryManager />);
    const input = screen.getByLabelText("Directory Path", {
      selector: "#delete-dir-path",
    });
    fireEvent.change(input, { target: { value: "old-docs" } });

    const deleteBtn = screen.getByRole("button", { name: /Delete Directory/i });
    fireEvent.click(deleteBtn);

    // Click confirm in dialog
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => {
      expect(mockApi.deleteDirectory).toHaveBeenCalledWith("old-docs");
      expect(mockToast.success).toHaveBeenCalledWith(
        "Directory deleted: old-docs",
      );
    });
  });

  it("shows error toast when delete fails", async () => {
    mockApi.deleteDirectory.mockRejectedValue(
      new Error("Directory not empty"),
    );

    render(<DirectoryManager />);
    const input = screen.getByLabelText("Directory Path", {
      selector: "#delete-dir-path",
    });
    fireEvent.change(input, { target: { value: "docs" } });

    const deleteBtn = screen.getByRole("button", { name: /Delete Directory/i });
    fireEvent.click(deleteBtn);

    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Directory not empty");
    });
  });

  it("renders warning about non-empty directories", () => {
    render(<DirectoryManager />);
    expect(
      screen.getByText(/Directories can only be deleted if they are empty/),
    ).toBeInTheDocument();
  });

  it("renders helpful info about directories", () => {
    render(<DirectoryManager />);
    expect(
      screen.getByText(
        /Directories help organize articles into hierarchical sections/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sidebar navigation reflects the directory structure/),
    ).toBeInTheDocument();
  });
});

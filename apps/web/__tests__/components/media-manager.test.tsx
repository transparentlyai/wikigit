import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockToast, mockApi } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockApi: {
    getMediaFiles: vi.fn(),
    uploadMedia: vi.fn(),
    deleteMediaFile: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({ default: mockToast }));
vi.mock("@/lib/api", () => ({ api: mockApi }));

// Mock Radix Dialog to render children directly when open
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
}));

// Mock Radix AlertDialog for ConfirmDialog
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

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Upload: () => <span data-testid="icon-upload" />,
  Trash2: () => <span data-testid="icon-trash" />,
  Image: () => <span data-testid="icon-image" />,
  File: () => <span data-testid="icon-file" />,
  Video: () => <span data-testid="icon-video" />,
  Music: () => <span data-testid="icon-music" />,
  FileText: () => <span data-testid="icon-file-text" />,
  X: () => <span data-testid="icon-x" />,
}));

import { MediaManager } from "@/components/media/media-manager";
import type { MediaFile } from "@/types/api";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleMediaFiles: MediaFile[] = [
  {
    filename: "photo.png",
    path: "/media/photo.png",
    size: 1024 * 50, // 50 KB
    content_type: "image/png",
    url: "/media/photo.png",
  },
  {
    filename: "document.pdf",
    path: "/media/document.pdf",
    size: 1024 * 1024 * 2, // 2 MB
    content_type: "application/pdf",
    url: "/media/document.pdf",
  },
  {
    filename: "video.mp4",
    path: "/media/video.mp4",
    size: 1024 * 1024 * 10, // 10 MB
    content_type: "video/mp4",
    url: "/media/video.mp4",
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MediaManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when closed", () => {
    render(<MediaManager isOpen={false} />);
    expect(screen.queryByText("Media Manager")).not.toBeInTheDocument();
  });

  it("renders the dialog when open", async () => {
    mockApi.getMediaFiles.mockResolvedValue({ files: [] });

    render(<MediaManager isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("Media Manager")).toBeInTheDocument();
    });
  });

  it("shows loading state while fetching", () => {
    mockApi.getMediaFiles.mockReturnValue(new Promise(() => {}));

    render(<MediaManager isOpen={true} />);
    expect(
      screen.getByText("Loading media files..."),
    ).toBeInTheDocument();
  });

  it("shows empty state when no media files exist", async () => {
    mockApi.getMediaFiles.mockResolvedValue({ files: [] });

    render(<MediaManager isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("No media files yet")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Upload files to get started"),
    ).toBeInTheDocument();
  });

  it("renders file list after fetching", async () => {
    mockApi.getMediaFiles.mockResolvedValue({ files: sampleMediaFiles });

    render(<MediaManager isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("photo.png")).toBeInTheDocument();
    });

    expect(screen.getByText("document.pdf")).toBeInTheDocument();
    expect(screen.getByText("video.mp4")).toBeInTheDocument();
  });

  it("displays formatted file sizes", async () => {
    mockApi.getMediaFiles.mockResolvedValue({ files: sampleMediaFiles });

    render(<MediaManager isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("photo.png")).toBeInTheDocument();
    });

    // 50 KB, 2.0 MB, 10.0 MB
    expect(screen.getByText("50.0 KB")).toBeInTheDocument();
    expect(screen.getByText("2.0 MB")).toBeInTheDocument();
    expect(screen.getByText("10.0 MB")).toBeInTheDocument();
  });

  it("renders image preview for image files", async () => {
    mockApi.getMediaFiles.mockResolvedValue({
      files: [sampleMediaFiles[0]],
    });

    render(<MediaManager isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("photo.png")).toBeInTheDocument();
    });

    const img = screen.getByAltText("photo.png");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/media/photo.png");
  });

  it("selecting a file shows it as selected", async () => {
    mockApi.getMediaFiles.mockResolvedValue({ files: sampleMediaFiles });

    render(<MediaManager isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("photo.png")).toBeInTheDocument();
    });

    // Click on the photo card
    const photoCard = screen.getByText("photo.png").closest("div[class*='cursor-pointer']");
    if (photoCard) {
      fireEvent.click(photoCard);
    }

    await waitFor(() => {
      expect(screen.getByText(/Selected:/)).toBeInTheDocument();
    });
  });

  it("calls onSelect when Insert button is clicked with a selection", async () => {
    mockApi.getMediaFiles.mockResolvedValue({ files: sampleMediaFiles });

    const onSelect = vi.fn();
    render(<MediaManager isOpen={true} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("photo.png")).toBeInTheDocument();
    });

    // Select the photo
    const photoCard = screen.getByText("photo.png").closest("div[class*='cursor-pointer']");
    if (photoCard) {
      fireEvent.click(photoCard);
    }

    // Click Insert
    const insertButton = screen.getByText("Insert");
    fireEvent.click(insertButton);

    expect(onSelect).toHaveBeenCalledWith(sampleMediaFiles[0]);
  });

  it("Insert button is disabled when no file is selected", async () => {
    mockApi.getMediaFiles.mockResolvedValue({ files: sampleMediaFiles });

    render(<MediaManager isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("photo.png")).toBeInTheDocument();
    });

    const insertButton = screen.getByText("Insert");
    expect(insertButton).toBeDisabled();
  });

  it("upload triggers API call", async () => {
    mockApi.getMediaFiles.mockResolvedValue({ files: [] });

    const uploadedFile: MediaFile = {
      filename: "new-image.jpg",
      path: "/media/new-image.jpg",
      size: 2048,
      content_type: "image/jpeg",
      url: "/media/new-image.jpg",
    };
    mockApi.uploadMedia.mockResolvedValue(uploadedFile);

    render(<MediaManager isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("No media files yet")).toBeInTheDocument();
    });

    // Find the hidden file input and simulate a file selection
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const testFile = new File(["test content"], "new-image.jpg", {
      type: "image/jpeg",
    });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(mockApi.uploadMedia).toHaveBeenCalledWith(testFile);
    });

    expect(mockToast.success).toHaveBeenCalledWith("Uploaded new-image.jpg");

    // The new file should appear in the list (also appears in "Selected: <strong>")
    await waitFor(() => {
      expect(screen.getAllByText("new-image.jpg").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows error toast when upload fails", async () => {
    mockApi.getMediaFiles.mockResolvedValue({ files: [] });
    mockApi.uploadMedia.mockRejectedValue(new Error("File too large"));

    render(<MediaManager isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("No media files yet")).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const testFile = new File(["big content"], "huge.jpg", {
      type: "image/jpeg",
    });

    fireEvent.change(fileInput, { target: { files: [testFile] } });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("File too large");
    });
  });

  it("delete shows confirmation dialog and deletes on confirm", async () => {
    mockApi.getMediaFiles.mockResolvedValue({ files: sampleMediaFiles });
    mockApi.deleteMediaFile.mockResolvedValue(undefined);

    render(<MediaManager isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("photo.png")).toBeInTheDocument();
    });

    // Click a delete button (the first one rendered)
    const deleteButtons = screen.getAllByLabelText("Delete file");
    fireEvent.click(deleteButtons[0]);

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(
        screen.getByText(/Are you sure you want to delete/),
      ).toBeInTheDocument();
    });

    // Click the Delete confirm button
    const confirmDelete = screen.getByText("Delete");
    fireEvent.click(confirmDelete);

    await waitFor(() => {
      expect(mockApi.deleteMediaFile).toHaveBeenCalledWith("photo.png");
    });

    expect(mockToast.success).toHaveBeenCalledWith("Deleted photo.png");
  });

  it("shows error toast when delete fails", async () => {
    mockApi.getMediaFiles.mockResolvedValue({
      files: [sampleMediaFiles[0]],
    });
    mockApi.deleteMediaFile.mockRejectedValue(
      new Error("Cannot delete"),
    );

    render(<MediaManager isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("photo.png")).toBeInTheDocument();
    });

    const deleteButton = screen.getByLabelText("Delete file");
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Cannot delete");
    });
  });

  it("loads media files when isOpen changes from false to true", async () => {
    mockApi.getMediaFiles.mockResolvedValue({ files: sampleMediaFiles });

    const { rerender } = render(<MediaManager isOpen={false} />);

    expect(mockApi.getMediaFiles).not.toHaveBeenCalled();

    rerender(<MediaManager isOpen={true} />);

    await waitFor(() => {
      expect(mockApi.getMediaFiles).toHaveBeenCalledTimes(1);
    });
  });

  it("calls onClose when Cancel button is clicked", async () => {
    mockApi.getMediaFiles.mockResolvedValue({ files: [] });

    const onClose = vi.fn();
    render(<MediaManager isOpen={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("Media Manager")).toBeInTheDocument();
    });

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("shows error toast when loading media files fails", async () => {
    mockApi.getMediaFiles.mockRejectedValue(
      new Error("Network error"),
    );

    render(<MediaManager isOpen={true} />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Network error");
    });
  });
});

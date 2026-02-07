import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Hoisted mock values
// ---------------------------------------------------------------------------

const { iconFactory, mockViewRef } = vi.hoisted(() => {
  const mockViewRef = {
    state: {
      doc: { toString: () => "initial" },
      selection: { main: { from: 0, to: 0 } },
      sliceDoc: vi.fn().mockReturnValue(""),
    },
    dispatch: vi.fn(),
    focus: vi.fn(),
    destroy: vi.fn(),
  };

  return {
    iconFactory: (name: string) => {
      const Icon = (props: any) =>
        React.createElement("svg", {
          "data-testid": `icon-${name}`,
          ...props,
        });
      Icon.displayName = name;
      return Icon;
    },
    mockViewRef,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@codemirror/state", () => ({
  EditorState: {
    create: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("@codemirror/view", () => ({
  EditorView: vi.fn().mockImplementation(({ parent }: any) => {
    // Return the mock view ref
    return mockViewRef;
  }),
  keymap: { of: vi.fn().mockReturnValue([]) },
  lineNumbers: vi.fn().mockReturnValue([]),
}));

// Attach static properties to EditorView mock
const EditorViewMock = vi.mocked(
  (await import("@codemirror/view")).EditorView,
);
Object.assign(EditorViewMock, {
  updateListener: { of: vi.fn().mockReturnValue([]) },
  lineWrapping: [],
  theme: vi.fn().mockReturnValue([]),
});

vi.mock("@codemirror/commands", () => ({
  defaultKeymap: [],
  history: vi.fn().mockReturnValue([]),
  historyKeymap: [],
}));

vi.mock("@codemirror/lang-markdown", () => ({
  markdown: vi.fn().mockReturnValue([]),
}));

vi.mock("@codemirror/language", () => ({
  syntaxHighlighting: vi.fn().mockReturnValue([]),
  HighlightStyle: {
    define: vi.fn().mockReturnValue({}),
  },
}));

vi.mock("@lezer/highlight", () => ({
  tags: new Proxy(
    {},
    {
      get: () => "mock-tag",
    },
  ),
}));

vi.mock("lucide-react", () => ({
  Bold: iconFactory("Bold"),
  Italic: iconFactory("Italic"),
  Hash: iconFactory("Hash"),
  Eye: iconFactory("Eye"),
  EyeOff: iconFactory("EyeOff"),
  Save: iconFactory("Save"),
  Strikethrough: iconFactory("Strikethrough"),
  Link2: iconFactory("Link2"),
  Quote: iconFactory("Quote"),
  Code: iconFactory("Code"),
  List: iconFactory("List"),
  ListOrdered: iconFactory("ListOrdered"),
  Image: iconFactory("Image"),
  Table: iconFactory("Table"),
  Minus: iconFactory("Minus"),
  Info: iconFactory("Info"),
  AlertTriangle: iconFactory("AlertTriangle"),
  Lightbulb: iconFactory("Lightbulb"),
  AlertCircle: iconFactory("AlertCircle"),
  OctagonAlert: iconFactory("OctagonAlert"),
  X: iconFactory("X"),
  Lock: iconFactory("Lock"),
}));

vi.mock("@/components/viewer/markdown-viewer", () => ({
  MarkdownViewer: ({ content }: any) => (
    <div data-testid="markdown-preview">{content}</div>
  ),
}));

vi.mock("@/components/media/media-manager", () => ({
  MediaManager: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="media-manager">
        <button onClick={onClose}>Close Media</button>
      </div>
    ) : null,
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
        <button onClick={onConfirm}>Confirm Discard</button>
        <button onClick={() => onOpenChange(false)}>Keep Editing</button>
      </div>
    ) : null,
}));

import { MarkdownEditor } from "@/components/editor/markdown-editor";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MarkdownEditor", () => {
  const defaultProps = {
    value: "# Hello",
    onChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    initialValue: "# Hello",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders toolbar buttons", () => {
    render(<MarkdownEditor {...defaultProps} />);
    expect(screen.getByTitle("Bold (Ctrl+B)")).toBeInTheDocument();
    expect(screen.getByTitle("Italic (Ctrl+I)")).toBeInTheDocument();
    expect(screen.getByTitle("Strikethrough")).toBeInTheDocument();
    expect(screen.getByTitle("Heading")).toBeInTheDocument();
    expect(screen.getByTitle("Quote")).toBeInTheDocument();
    expect(screen.getByTitle("Inline Code")).toBeInTheDocument();
    expect(screen.getByTitle("Bullet List")).toBeInTheDocument();
    expect(screen.getByTitle("Numbered List")).toBeInTheDocument();
    expect(screen.getByTitle("Insert Link")).toBeInTheDocument();
    expect(screen.getByTitle("Insert Image")).toBeInTheDocument();
    expect(screen.getByTitle("Insert Table")).toBeInTheDocument();
    expect(screen.getByTitle("Horizontal Rule")).toBeInTheDocument();
  });

  it("renders callout buttons", () => {
    render(<MarkdownEditor {...defaultProps} />);
    expect(screen.getByTitle("Insert Info Callout")).toBeInTheDocument();
    expect(screen.getByTitle("Insert Tip Callout")).toBeInTheDocument();
    expect(screen.getByTitle("Insert Important Callout")).toBeInTheDocument();
    expect(screen.getByTitle("Insert Warning Callout")).toBeInTheDocument();
    expect(screen.getByTitle("Insert Caution Callout")).toBeInTheDocument();
  });

  it("renders Save and Cancel buttons", () => {
    render(<MarkdownEditor {...defaultProps} />);
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onSave when Save button is clicked", () => {
    render(<MarkdownEditor {...defaultProps} />);
    fireEvent.click(screen.getByText("Save"));
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel directly when no unsaved changes", () => {
    render(
      <MarkdownEditor {...defaultProps} value="# Hello" initialValue="# Hello" />,
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows confirm dialog when canceling with unsaved changes", () => {
    render(
      <MarkdownEditor
        {...defaultProps}
        value="# Modified"
        initialValue="# Hello"
      />,
    );
    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Discard Changes")).toBeInTheDocument();
  });

  it("confirms cancel discards changes", () => {
    const onCancel = vi.fn();
    render(
      <MarkdownEditor
        {...defaultProps}
        value="# Modified"
        initialValue="# Hello"
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Cancel"));
    fireEvent.click(screen.getByText("Confirm Discard"));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("toggles preview mode", () => {
    render(<MarkdownEditor {...defaultProps} />);

    // Initially no preview
    expect(screen.queryByTestId("markdown-preview")).not.toBeInTheDocument();

    // Click preview toggle
    fireEvent.click(screen.getByTitle("Toggle Preview"));

    // Preview should be visible
    expect(screen.getByTestId("markdown-preview")).toBeInTheDocument();
  });

  it("shows editor content in preview", () => {
    render(<MarkdownEditor {...defaultProps} value="# Test Content" />);
    fireEvent.click(screen.getByTitle("Toggle Preview"));

    expect(screen.getByTestId("markdown-preview")).toHaveTextContent(
      "# Test Content",
    );
  });

  it("opens media manager when image button clicked", () => {
    render(<MarkdownEditor {...defaultProps} />);

    expect(screen.queryByTestId("media-manager")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Insert Image"));

    expect(screen.getByTestId("media-manager")).toBeInTheDocument();
  });

  it("closes media manager", () => {
    render(<MarkdownEditor {...defaultProps} />);
    fireEvent.click(screen.getByTitle("Insert Image"));
    expect(screen.getByTestId("media-manager")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close Media"));
    expect(screen.queryByTestId("media-manager")).not.toBeInTheDocument();
  });

  it("shows read-only warning banner when isReadOnly", () => {
    render(<MarkdownEditor {...defaultProps} isReadOnly={true} />);
    expect(
      screen.getByText("This repository is read-only. You cannot save changes."),
    ).toBeInTheDocument();
  });

  it("does not show read-only banner by default", () => {
    render(<MarkdownEditor {...defaultProps} />);
    expect(
      screen.queryByText(
        "This repository is read-only. You cannot save changes.",
      ),
    ).not.toBeInTheDocument();
  });

  it("disables save button when read-only", () => {
    render(<MarkdownEditor {...defaultProps} isReadOnly={true} />);
    const saveBtn = screen.getByText("Save").closest("button");
    expect(saveBtn).toBeDisabled();
  });

  it("shows save tooltip with read-only message", () => {
    render(<MarkdownEditor {...defaultProps} isReadOnly={true} />);
    const saveBtn = screen.getByText("Save").closest("button");
    expect(saveBtn).toHaveAttribute(
      "title",
      "Cannot save in read-only mode",
    );
  });

  it("shows normal save tooltip when not read-only", () => {
    render(<MarkdownEditor {...defaultProps} />);
    const saveBtn = screen.getByText("Save").closest("button");
    expect(saveBtn).toHaveAttribute("title", "Save (Ctrl+S)");
  });
});

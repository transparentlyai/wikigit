import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Hoisted mock values
// ---------------------------------------------------------------------------

const { iconFactory, mockCodeToHtml } = vi.hoisted(() => ({
  iconFactory: (name: string) => {
    const Icon = (props: any) =>
      React.createElement("svg", {
        "data-testid": `icon-${name}`,
        ...props,
      });
    Icon.displayName = name;
    return Icon;
  },
  mockCodeToHtml: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  Info: iconFactory("Info"),
  AlertCircle: iconFactory("AlertCircle"),
  Lightbulb: iconFactory("Lightbulb"),
  AlertTriangle: iconFactory("AlertTriangle"),
  OctagonAlert: iconFactory("OctagonAlert"),
  ChevronRight: iconFactory("ChevronRight"),
  Save: iconFactory("Save"),
  X: iconFactory("X"),
  Eye: iconFactory("Eye"),
}));

vi.mock("shiki", () => ({
  codeToHtml: mockCodeToHtml,
}));

import { Callout } from "@/components/ui/callout";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { TableOfContents } from "@/components/viewer/table-of-contents";
import { CodeViewer } from "@/components/viewer/code-viewer";
import { EditorToolbar } from "@/components/editor/editor-toolbar";

// ---------------------------------------------------------------------------
// Callout Tests
// ---------------------------------------------------------------------------

describe("Callout", () => {
  it("renders info callout by default", () => {
    render(<Callout>Some info</Callout>);
    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText("Some info")).toBeInTheDocument();
    expect(screen.getByTestId("icon-Info")).toBeInTheDocument();
  });

  it("renders warning callout", () => {
    render(<Callout type="warning">Be careful</Callout>);
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Be careful")).toBeInTheDocument();
    expect(screen.getByTestId("icon-AlertTriangle")).toBeInTheDocument();
  });

  it("renders success/tip callout", () => {
    render(<Callout type="success">A helpful tip</Callout>);
    expect(screen.getByText("Tip")).toBeInTheDocument();
    expect(screen.getByTestId("icon-Lightbulb")).toBeInTheDocument();
  });

  it("renders important callout", () => {
    render(<Callout type="important">Pay attention</Callout>);
    expect(screen.getByText("Important")).toBeInTheDocument();
    expect(screen.getByTestId("icon-AlertCircle")).toBeInTheDocument();
  });

  it("renders caution callout", () => {
    render(<Callout type="caution">Danger zone</Callout>);
    expect(screen.getByText("Caution")).toBeInTheDocument();
    expect(screen.getByTestId("icon-OctagonAlert")).toBeInTheDocument();
  });

  it("uses custom title when provided", () => {
    render(
      <Callout type="info" title="Custom Title">
        Content
      </Callout>,
    );
    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    // Default label "Note" should not appear when custom title is set
    expect(screen.queryByText("Note")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Breadcrumbs Tests
// ---------------------------------------------------------------------------

describe("Breadcrumbs", () => {
  it("returns null for empty items", () => {
    const { container } = render(<Breadcrumbs items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Home link always", () => {
    render(<Breadcrumbs items={[{ label: "Page" }]} />);
    const homeLink = screen.getByText("Home");
    expect(homeLink.closest("a")).toHaveAttribute("href", "/");
  });

  it("renders single item", () => {
    render(<Breadcrumbs items={[{ label: "About" }]} />);
    expect(screen.getByText("About")).toBeInTheDocument();
    expect(screen.getByTestId("icon-ChevronRight")).toBeInTheDocument();
  });

  it("renders last item as text (not link)", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Guide" },
        ]}
      />,
    );
    const guide = screen.getByText("Guide");
    expect(guide.tagName).toBe("SPAN");
    expect(guide.className).toContain("font-medium");
  });

  it("renders intermediate items as links", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Guide", href: "/docs/guide" },
          { label: "Page" },
        ]}
      />,
    );
    const docsLink = screen.getByText("Docs");
    expect(docsLink.closest("a")).toHaveAttribute("href", "/docs");
  });

  it("renders multiple chevron separators", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "A", href: "/a" },
          { label: "B", href: "/b" },
          { label: "C" },
        ]}
      />,
    );
    expect(screen.getAllByTestId("icon-ChevronRight")).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// TableOfContents Tests
// ---------------------------------------------------------------------------

describe("TableOfContents", () => {
  it("returns null when no headings found", () => {
    const { container } = render(
      <TableOfContents content="No headings here" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders Contents title", () => {
    render(<TableOfContents content="## First Section" />);
    expect(screen.getByText("Contents")).toBeInTheDocument();
  });

  it("extracts h2 headings", () => {
    render(
      <TableOfContents content={"## Introduction\n## Conclusion"} />,
    );
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Conclusion")).toBeInTheDocument();
  });

  it("extracts h3 headings", () => {
    render(<TableOfContents content={"### Sub Section"} />);
    expect(screen.getByText("Sub Section")).toBeInTheDocument();
  });

  it("generates correct anchor links", () => {
    render(<TableOfContents content={"## Hello World"} />);
    const link = screen.getByText("Hello World").closest("a");
    expect(link).toHaveAttribute("href", "#hello-world");
  });

  it("does not extract h1 headings", () => {
    const { container } = render(
      <TableOfContents content={"# Title Only"} />,
    );
    // h1 is not extracted, so TOC should be empty
    expect(container.firstChild).toBeNull();
  });

  it("applies correct level classes", () => {
    const { container } = render(
      <TableOfContents content={"## Level Two\n### Level Three"} />,
    );
    const items = container.querySelectorAll("li");
    expect(items[0].className).toContain("toc-level-2");
    expect(items[1].className).toContain("toc-level-3");
  });
});

// ---------------------------------------------------------------------------
// CodeViewer Tests
// ---------------------------------------------------------------------------

describe("CodeViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCodeToHtml.mockResolvedValue(
      '<pre class="shiki"><code>highlighted</code></pre>',
    );
  });

  it("renders the filename", async () => {
    await act(async () => {
      render(
        <CodeViewer content="const x = 1;" language="javascript" filename="index.js" />,
      );
    });
    expect(screen.getByText("index.js")).toBeInTheDocument();
  });

  it("renders the language label", async () => {
    await act(async () => {
      render(
        <CodeViewer content="x = 1" language="python" filename="script.py" />,
      );
    });
    expect(screen.getByText("python")).toBeInTheDocument();
  });

  it("calls codeToHtml with correct params", async () => {
    await act(async () => {
      render(
        <CodeViewer content="const x = 1;" language="javascript" filename="index.js" />,
      );
    });

    await waitFor(() => {
      expect(mockCodeToHtml).toHaveBeenCalledWith("const x = 1;", {
        lang: "javascript",
        theme: "github-dark-dimmed",
      });
    });
  });

  it("derives language from filename extension when not provided", async () => {
    await act(async () => {
      render(
        <CodeViewer content="print('hi')" filename="script.py" />,
      );
    });

    await waitFor(() => {
      expect(mockCodeToHtml).toHaveBeenCalledWith("print('hi')", {
        lang: "py",
        theme: "github-dark-dimmed",
      });
    });
  });

  it("shows file extension as language when no explicit language", async () => {
    await act(async () => {
      render(
        <CodeViewer content="code" filename="file.rs" />,
      );
    });
    expect(screen.getByText("rs")).toBeInTheDocument();
  });

  it("handles shiki error gracefully", async () => {
    mockCodeToHtml.mockRejectedValue(new Error("Unknown language"));

    await act(async () => {
      render(
        <CodeViewer content="code here" language="unknown" filename="file.txt" />,
      );
    });

    await waitFor(() => {
      // Should show fallback code block
      expect(screen.getByText("file.txt")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// EditorToolbar Tests
// ---------------------------------------------------------------------------

describe("EditorToolbar", () => {
  const defaultProps = {
    onSave: vi.fn(),
    onCancel: vi.fn(),
    isSaving: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Save and Cancel buttons", () => {
    render(<EditorToolbar {...defaultProps} />);
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders Preview button (disabled)", () => {
    render(<EditorToolbar {...defaultProps} />);
    const previewBtn = screen.getByText("Preview").closest("button");
    expect(previewBtn).toBeDisabled();
  });

  it("calls onSave when Save clicked", () => {
    render(<EditorToolbar {...defaultProps} />);
    screen.getByText("Save").closest("button")!.click();
    expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel clicked", () => {
    render(<EditorToolbar {...defaultProps} />);
    screen.getByText("Cancel").closest("button")!.click();
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows Saving... when isSaving is true", () => {
    render(<EditorToolbar {...defaultProps} isSaving={true} />);
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("disables buttons when saving", () => {
    render(<EditorToolbar {...defaultProps} isSaving={true} />);
    const saveBtn = screen.getByText("Saving...").closest("button");
    expect(saveBtn).toBeDisabled();
  });
});

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

vi.mock("react-markdown", () => ({
  default: ({ children, components }: any) => {
    // Simple renderer that applies custom components
    if (!components) return <div data-testid="markdown">{children}</div>;

    // Parse basic markdown to exercise component overrides
    const lines = (children || "").split("\n");
    const rendered: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("# ")) {
        const text = line.slice(2);
        if (components.h1) {
          rendered.push(
            <React.Fragment key={i}>
              {components.h1({ children: text })}
            </React.Fragment>,
          );
        }
      } else if (line.startsWith("## ")) {
        const text = line.slice(3);
        if (components.h2) {
          rendered.push(
            <React.Fragment key={i}>
              {components.h2({ children: text })}
            </React.Fragment>,
          );
        }
      } else if (line.startsWith("### ")) {
        const text = line.slice(4);
        if (components.h3) {
          rendered.push(
            <React.Fragment key={i}>
              {components.h3({ children: text })}
            </React.Fragment>,
          );
        }
      } else if (line.startsWith("![")) {
        // Parse ![alt](src)
        const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        if (imgMatch && components.img) {
          rendered.push(
            <React.Fragment key={i}>
              {components.img({ alt: imgMatch[1], src: imgMatch[2] })}
            </React.Fragment>,
          );
        }
      } else if (line.startsWith("[")) {
        // Parse [text](href)
        const linkMatch = line.match(/\[([^\]]*)\]\(([^)]+)\)/);
        if (linkMatch && components.a) {
          rendered.push(
            <React.Fragment key={i}>
              {components.a({
                href: linkMatch[2],
                children: linkMatch[1],
              })}
            </React.Fragment>,
          );
        }
      } else if (line.startsWith("```")) {
        // Code block
        const lang = line.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        if (components.code) {
          rendered.push(
            <React.Fragment key={i}>
              {components.code({
                className: lang ? `language-${lang}` : undefined,
                children: codeLines.join("\n"),
              })}
            </React.Fragment>,
          );
        }
      } else if (line.startsWith("`") && line.endsWith("`") && line.length > 2) {
        // Inline code
        if (components.code) {
          rendered.push(
            <React.Fragment key={i}>
              {components.code({
                inline: true,
                children: line.slice(1, -1),
              })}
            </React.Fragment>,
          );
        }
      } else if (line.trim()) {
        if (components.p) {
          rendered.push(
            <React.Fragment key={i}>
              {components.p({ children: line })}
            </React.Fragment>,
          );
        } else {
          rendered.push(<p key={i}>{line}</p>);
        }
      }
    }

    return <div data-testid="markdown">{rendered}</div>;
  },
}));

vi.mock("remark-gfm", () => ({ default: {} }));
vi.mock("remark-github-blockquote-alert", () => ({ remarkAlert: {} }));

vi.mock("shiki", () => ({
  bundledLanguages: { javascript: true, typescript: true, python: true },
  codeToHtml: mockCodeToHtml,
}));

vi.mock("lucide-react", () => ({
  Hash: iconFactory("Hash"),
  Copy: iconFactory("Copy"),
}));

vi.mock("@/components/ui/callout", () => ({
  Callout: ({ children, type }: any) => (
    <div data-testid={`callout-${type}`}>{children}</div>
  ),
}));

import { MarkdownViewer } from "@/components/viewer/markdown-viewer";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MarkdownViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCodeToHtml.mockResolvedValue(
      '<pre class="shiki"><code>highlighted</code></pre>',
    );
  });

  it("renders markdown content", () => {
    render(<MarkdownViewer content="Hello world" />);
    expect(screen.getByTestId("markdown")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("wraps content in prose class div", () => {
    const { container } = render(<MarkdownViewer content="test" />);
    expect(container.querySelector(".prose")).toBeInTheDocument();
  });

  it("renders h1 with slugified id", () => {
    render(<MarkdownViewer content="# Hello World" />);
    const h1 = screen.getByText("Hello World");
    expect(h1.closest("h1")).toHaveAttribute("id", "hello-world");
  });

  it("renders h2 with hash anchor link", () => {
    render(<MarkdownViewer content="## Section Title" />);
    const h2 = screen.getByText("Section Title");
    expect(h2.closest("h2")).toHaveAttribute("id", "section-title");
    // h2 has a hash anchor link
    expect(screen.getByTestId("icon-Hash")).toBeInTheDocument();
  });

  it("renders h3 with slugified id", () => {
    render(<MarkdownViewer content="### Sub Section" />);
    const h3 = screen.getByText("Sub Section");
    expect(h3.closest("h3")).toHaveAttribute("id", "sub-section");
  });

  it("renders inline code with special styling", () => {
    render(<MarkdownViewer content="`inline code`" />);
    const code = screen.getByText("inline code");
    expect(code.tagName).toBe("CODE");
    expect(code.style.backgroundColor).toBe("rgb(255, 243, 224)");
  });

  it("renders fenced code block", async () => {
    await act(async () => {
      render(
        <MarkdownViewer content={"```javascript\nconst x = 1;\n```"} />,
      );
    });

    await waitFor(() => {
      // After shiki processes, highlighted code should appear
      expect(mockCodeToHtml).toHaveBeenCalledWith("const x = 1;", {
        lang: "javascript",
        theme: "github-dark-dimmed",
      });
    });
  });

  it("renders images with cleaned src", () => {
    render(<MarkdownViewer content="![alt text](image.png)" />);
    const img = screen.getByAltText("alt text");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "image.png");
  });

  it("rewrites absolute image paths with repositoryId", () => {
    render(
      <MarkdownViewer
        content="![logo](/assets/logo.png)"
        repositoryId="my-repo"
      />,
    );
    const img = screen.getByAltText("logo");
    expect(img).toHaveAttribute(
      "src",
      "/api/repositories/my-repo/assets/logo.png",
    );
  });

  it("rewrites absolute links with repositoryId", () => {
    render(
      <MarkdownViewer
        content="[Guide](/docs/guide.md)"
        repositoryId="my-repo"
      />,
    );
    const link = screen.getByText("Guide");
    expect(link).toHaveAttribute("href", "/my-repo/docs/guide.md");
  });

  it("does not rewrite external links", () => {
    render(
      <MarkdownViewer
        content="[Google](https://google.com)"
        repositoryId="my-repo"
      />,
    );
    const link = screen.getByText("Google");
    expect(link).toHaveAttribute("href", "https://google.com");
  });

  it("renders paragraphs", () => {
    render(<MarkdownViewer content="A paragraph of text" />);
    expect(screen.getByText("A paragraph of text")).toBeInTheDocument();
  });

  it("handles code block with unsupported language", async () => {
    await act(async () => {
      render(
        <MarkdownViewer content={"```cobol\nDISPLAY 'HI'.\n```"} />,
      );
    });

    // cobol is not in bundledLanguages, should use fallback
    expect(mockCodeToHtml).not.toHaveBeenCalled();
  });

  it("handles image with query params for sizing", () => {
    render(
      <MarkdownViewer content="![sized](image.png?width=300&height=200)" />,
    );
    const img = screen.getByAltText("sized");
    expect(img).toHaveAttribute("src", "image.png");
    expect(img).toHaveAttribute("width", "300");
    expect(img).toHaveAttribute("height", "200");
  });

  it("renders empty content", () => {
    render(<MarkdownViewer content="" />);
    expect(screen.getByTestId("markdown")).toBeInTheDocument();
  });
});

import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Hoisted mock values
// ---------------------------------------------------------------------------

const { iconFactory } = vi.hoisted(() => ({
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

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  Folder: iconFactory("Folder"),
  FileText: iconFactory("FileText"),
}));

import { ArticleMetadata } from "@/components/viewer/article-metadata";
import { DirectoryListing } from "@/components/viewer/directory-listing";

// ---------------------------------------------------------------------------
// ArticleMetadata Tests
// ---------------------------------------------------------------------------

describe("ArticleMetadata", () => {
  it("renders nothing when no metadata provided", () => {
    const { container } = render(
      <ArticleMetadata
        author={null}
        createdAt={null}
        updatedAt={null}
        updatedBy={null}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders author and creation date", () => {
    render(
      <ArticleMetadata
        author="John Doe"
        createdAt="2024-01-15T10:00:00Z"
        updatedAt={null}
        updatedBy={null}
      />,
    );
    expect(screen.getByText(/Created by John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/January 15, 2024/)).toBeInTheDocument();
  });

  it("renders updated by and date", () => {
    render(
      <ArticleMetadata
        author={null}
        createdAt={null}
        updatedAt="2024-06-20T14:30:00Z"
        updatedBy="Jane Smith"
      />,
    );
    expect(
      screen.getByText(/Last updated by Jane Smith/),
    ).toBeInTheDocument();
    expect(screen.getByText(/June 20, 2024/)).toBeInTheDocument();
  });

  it("renders both creation and update metadata", () => {
    render(
      <ArticleMetadata
        author="John"
        createdAt="2024-01-01T00:00:00Z"
        updatedAt="2024-06-15T00:00:00Z"
        updatedBy="Jane"
      />,
    );
    expect(screen.getByText(/Created by John/)).toBeInTheDocument();
    expect(screen.getByText(/Last updated by Jane/)).toBeInTheDocument();
  });

  it("handles invalid date strings gracefully", () => {
    render(
      <ArticleMetadata
        author="John"
        createdAt="not-a-date"
        updatedAt={null}
        updatedBy={null}
      />,
    );
    // Invalid date falls back to showing the raw string
    expect(screen.getByText(/Created by John on not-a-date/)).toBeInTheDocument();
  });

  it("renders only author without date when createdAt is null", () => {
    const { container } = render(
      <ArticleMetadata
        author="John"
        createdAt={null}
        updatedAt={null}
        updatedBy={null}
      />,
    );
    // With only author but no date, the "Created by" line won't render (requires both)
    // But the div still renders because author is truthy
    expect(container.firstChild).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DirectoryListing Tests
// ---------------------------------------------------------------------------

describe("DirectoryListing", () => {
  it("renders the directory name as heading", () => {
    render(
      <DirectoryListing
        directoryName="docs"
        contents={[]}
        currentPath="docs"
      />,
    );
    expect(screen.getByText("docs")).toBeInTheDocument();
  });

  it("shows empty message when no contents", () => {
    render(
      <DirectoryListing
        directoryName="empty"
        contents={[]}
        currentPath="empty"
      />,
    );
    expect(screen.getByText("This directory is empty.")).toBeInTheDocument();
  });

  it("renders files with FileText icon", () => {
    render(
      <DirectoryListing
        directoryName="docs"
        contents={[
          { type: "file", name: "readme.md", path: "docs/readme.md" },
        ]}
        currentPath="docs"
      />,
    );
    expect(screen.getByText("readme.md")).toBeInTheDocument();
    expect(screen.getByTestId("icon-FileText")).toBeInTheDocument();
  });

  it("renders directories with Folder icon", () => {
    render(
      <DirectoryListing
        directoryName="docs"
        contents={[
          {
            type: "directory",
            name: "guides",
            path: "docs/guides",
            children: [],
          },
        ]}
        currentPath="docs"
      />,
    );
    expect(screen.getByText("guides")).toBeInTheDocument();
    expect(screen.getByTestId("icon-Folder")).toBeInTheDocument();
  });

  it("sorts directories before files", () => {
    render(
      <DirectoryListing
        directoryName="root"
        contents={[
          { type: "file", name: "b-file.md", path: "b-file.md" },
          {
            type: "directory",
            name: "a-dir",
            path: "a-dir",
            children: [],
          },
          { type: "file", name: "a-file.md", path: "a-file.md" },
        ]}
        currentPath=""
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("a-dir");
    expect(items[1]).toHaveTextContent("a-file.md");
    expect(items[2]).toHaveTextContent("b-file.md");
  });

  it("sorts items alphabetically within each group", () => {
    render(
      <DirectoryListing
        directoryName="root"
        contents={[
          {
            type: "directory",
            name: "z-dir",
            path: "z-dir",
            children: [],
          },
          {
            type: "directory",
            name: "a-dir",
            path: "a-dir",
            children: [],
          },
        ]}
        currentPath=""
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("a-dir");
    expect(items[1]).toHaveTextContent("z-dir");
  });

  it("builds correct links with repositoryId", () => {
    render(
      <DirectoryListing
        directoryName="docs"
        contents={[
          { type: "file", name: "guide.md", path: "docs/guide.md" },
        ]}
        repositoryId="my-repo"
        currentPath="docs"
      />,
    );

    const link = screen.getByText("guide.md").closest("a");
    expect(link).toHaveAttribute("href", "/my-repo/docs/guide.md");
  });

  it("builds correct links without repositoryId", () => {
    render(
      <DirectoryListing
        directoryName="docs"
        contents={[
          { type: "file", name: "guide.md", path: "docs/guide.md" },
        ]}
        currentPath="docs"
      />,
    );

    const link = screen.getByText("guide.md").closest("a");
    expect(link).toHaveAttribute("href", "/docs/guide.md");
  });

  it("renders multiple items correctly", () => {
    render(
      <DirectoryListing
        directoryName="project"
        contents={[
          { type: "file", name: "readme.md", path: "readme.md" },
          { type: "file", name: "license.md", path: "license.md" },
          {
            type: "directory",
            name: "src",
            path: "src",
            children: [],
          },
        ]}
        currentPath=""
      />,
    );

    expect(screen.getByText("readme.md")).toBeInTheDocument();
    expect(screen.getByText("license.md")).toBeInTheDocument();
    expect(screen.getByText("src")).toBeInTheDocument();
  });
});

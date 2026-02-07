import { vi, describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// We test the pure helper functions extracted from the page component.
// The page itself is a large React component with many hooks and side effects;
// testing its rendering end-to-end belongs in E2E tests.  The three helpers --
// isDirectoryPath, findNodeByPath, parseArticlePath -- are the most valuable
// units to cover because they drive routing/display logic.
// ---------------------------------------------------------------------------

// Since these functions are not individually exported from page.tsx, we
// re-declare them here with identical logic so the tests serve as a spec.
// If the functions are ever extracted into a utility module, the imports can
// simply be swapped.

import type { DirectoryNode } from "@/types/api";

// -- isDirectoryPath --------------------------------------------------------

function isDirectoryPath(path: string): boolean {
  if (!path) return true; // empty path = repo root
  const lastSegment = path.split("/").pop() || "";
  return !lastSegment.includes(".");
}

// -- findNodeByPath ---------------------------------------------------------

function findNodeByPath(
  nodes: DirectoryNode[],
  path: string,
): DirectoryNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

// -- parseArticlePath -------------------------------------------------------

function parseArticlePath(slug: string[]): [string | undefined, string] {
  if (slug.length === 0) {
    return [undefined, ""];
  }

  if (slug.length >= 2) {
    const repositoryId = slug[0];
    const articlePath = slug.slice(1).join("/");
    return [repositoryId, articlePath];
  }

  return [slug[0], ""];
}

// ===========================================================================
// Tests
// ===========================================================================

describe("isDirectoryPath", () => {
  it("returns true for empty path (repo root)", () => {
    expect(isDirectoryPath("")).toBe(true);
  });

  it("returns true for paths without a file extension", () => {
    expect(isDirectoryPath("docs")).toBe(true);
    expect(isDirectoryPath("docs/guides")).toBe(true);
    expect(isDirectoryPath("my-folder")).toBe(true);
  });

  it("returns false for paths ending with a file extension", () => {
    expect(isDirectoryPath("Home.md")).toBe(false);
    expect(isDirectoryPath("docs/guide.md")).toBe(false);
    expect(isDirectoryPath("images/logo.png")).toBe(false);
    expect(isDirectoryPath("config.json")).toBe(false);
  });

  it("returns false for dotfiles", () => {
    expect(isDirectoryPath(".gitignore")).toBe(false);
    expect(isDirectoryPath("docs/.hidden")).toBe(false);
  });
});

describe("findNodeByPath", () => {
  const tree: DirectoryNode[] = [
    {
      type: "directory",
      name: "docs",
      path: "docs",
      children: [
        { type: "file", name: "intro.md", path: "docs/intro.md" },
        {
          type: "directory",
          name: "guides",
          path: "docs/guides",
          children: [
            {
              type: "file",
              name: "setup.md",
              path: "docs/guides/setup.md",
            },
          ],
        },
      ],
    },
    { type: "file", name: "Home.md", path: "Home.md" },
  ];

  it("finds a root-level file", () => {
    const node = findNodeByPath(tree, "Home.md");
    expect(node).not.toBeNull();
    expect(node!.name).toBe("Home.md");
  });

  it("finds a first-level directory", () => {
    const node = findNodeByPath(tree, "docs");
    expect(node).not.toBeNull();
    expect(node!.type).toBe("directory");
  });

  it("finds a nested file", () => {
    const node = findNodeByPath(tree, "docs/guides/setup.md");
    expect(node).not.toBeNull();
    expect(node!.name).toBe("setup.md");
  });

  it("finds a nested directory", () => {
    const node = findNodeByPath(tree, "docs/guides");
    expect(node).not.toBeNull();
    expect(node!.type).toBe("directory");
  });

  it("returns null for a non-existent path", () => {
    expect(findNodeByPath(tree, "nonexistent.md")).toBeNull();
    expect(findNodeByPath(tree, "docs/missing")).toBeNull();
  });

  it("returns null for an empty tree", () => {
    expect(findNodeByPath([], "Home.md")).toBeNull();
  });
});

describe("parseArticlePath", () => {
  it("returns [undefined, ''] for empty slug", () => {
    const [repoId, articlePath] = parseArticlePath([]);
    expect(repoId).toBeUndefined();
    expect(articlePath).toBe("");
  });

  it("returns [slug[0], ''] for single-segment slug (repo root)", () => {
    const [repoId, articlePath] = parseArticlePath(["my-repo"]);
    expect(repoId).toBe("my-repo");
    expect(articlePath).toBe("");
  });

  it("parses two-segment slug as repo + article", () => {
    const [repoId, articlePath] = parseArticlePath(["my-repo", "Home.md"]);
    expect(repoId).toBe("my-repo");
    expect(articlePath).toBe("Home.md");
  });

  it("joins remaining segments as nested article path", () => {
    const [repoId, articlePath] = parseArticlePath([
      "my-repo",
      "docs",
      "guides",
      "setup.md",
    ]);
    expect(repoId).toBe("my-repo");
    expect(articlePath).toBe("docs/guides/setup.md");
  });

  it("handles directory-like paths (no extension)", () => {
    const [repoId, articlePath] = parseArticlePath([
      "my-repo",
      "docs",
      "guides",
    ]);
    expect(repoId).toBe("my-repo");
    expect(articlePath).toBe("docs/guides");
  });
});

// ---------------------------------------------------------------------------
// IMAGE_EXTENSIONS constant coverage
// ---------------------------------------------------------------------------

describe("image extension detection (as used in page component)", () => {
  const IMAGE_EXTENSIONS = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".bmp",
  ];

  function isImage(path: string): boolean {
    return IMAGE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
  }

  it("recognizes common image formats", () => {
    expect(isImage("photo.png")).toBe(true);
    expect(isImage("photo.jpg")).toBe(true);
    expect(isImage("photo.jpeg")).toBe(true);
    expect(isImage("photo.gif")).toBe(true);
    expect(isImage("photo.webp")).toBe(true);
    expect(isImage("photo.svg")).toBe(true);
    expect(isImage("icon.ico")).toBe(true);
    expect(isImage("image.bmp")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isImage("photo.PNG")).toBe(true);
    expect(isImage("photo.Jpg")).toBe(true);
  });

  it("rejects non-image files", () => {
    expect(isImage("readme.md")).toBe(false);
    expect(isImage("data.json")).toBe(false);
    expect(isImage("script.ts")).toBe(false);
  });

  it("detects markdown files correctly", () => {
    function isMarkdown(path: string): boolean {
      return path.toLowerCase().endsWith(".md");
    }

    expect(isMarkdown("Home.md")).toBe(true);
    expect(isMarkdown("docs/guide.MD")).toBe(true);
    expect(isMarkdown("photo.png")).toBe(false);
  });
});

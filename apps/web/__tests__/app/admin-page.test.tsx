import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

vi.mock("@/components/layout/main-layout", () => ({
  MainLayout: ({ children }: any) => (
    <div data-testid="main-layout">{children}</div>
  ),
}));

vi.mock("@/components/admin/search-manager", () => ({
  SearchManager: () => <div data-testid="search-manager">SearchManager</div>,
}));

vi.mock("@/components/admin/config-manager", () => ({
  ConfigManager: () => <div data-testid="config-manager">ConfigManager</div>,
}));

vi.mock("@/components/admin/repositories/github-settings", () => ({
  GitHubSettings: () => (
    <div data-testid="github-settings">GitHubSettings</div>
  ),
}));

vi.mock("@/components/admin/repositories/repository-scanner", () => ({
  RepositoryScanner: () => (
    <div data-testid="repo-scanner">RepositoryScanner</div>
  ),
}));

vi.mock("@/components/admin/repositories/repository-list", () => ({
  RepositoryList: () => <div data-testid="repo-list">RepositoryList</div>,
}));

vi.mock("lucide-react", () => ({
  Database: iconFactory("Database"),
  Search: iconFactory("Search"),
  Settings: iconFactory("Settings"),
  Github: iconFactory("Github"),
}));

import AdminPage from "@/app/admin/page";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders inside MainLayout", () => {
    render(<AdminPage />);
    expect(screen.getByTestId("main-layout")).toBeInTheDocument();
  });

  it("renders the page title", () => {
    render(<AdminPage />);
    expect(screen.getByText("Admin Panel")).toBeInTheDocument();
  });

  it("renders the description text", () => {
    render(<AdminPage />);
    expect(
      screen.getByText(
        "Manage repositories, search index, and configuration settings.",
      ),
    ).toBeInTheDocument();
  });

  it("renders all four tabs", () => {
    render(<AdminPage />);
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("GitHub Integration")).toBeInTheDocument();
    expect(screen.getByText("Repositories")).toBeInTheDocument();
    expect(screen.getByText("Search Index")).toBeInTheDocument();
  });

  it("renders tab icons", () => {
    render(<AdminPage />);
    expect(screen.getByTestId("icon-Settings")).toBeInTheDocument();
    expect(screen.getByTestId("icon-Github")).toBeInTheDocument();
    expect(screen.getByTestId("icon-Database")).toBeInTheDocument();
    expect(screen.getByTestId("icon-Search")).toBeInTheDocument();
  });

  it("shows ConfigManager by default (config tab)", () => {
    render(<AdminPage />);
    expect(screen.getByTestId("config-manager")).toBeInTheDocument();
    expect(screen.queryByTestId("github-settings")).not.toBeInTheDocument();
    expect(screen.queryByTestId("repo-scanner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("search-manager")).not.toBeInTheDocument();
  });

  it("switches to GitHub Integration tab", () => {
    render(<AdminPage />);
    fireEvent.click(screen.getByText("GitHub Integration"));
    expect(screen.getByTestId("github-settings")).toBeInTheDocument();
    expect(screen.queryByTestId("config-manager")).not.toBeInTheDocument();
  });

  it("switches to Repositories tab showing scanner and list", () => {
    render(<AdminPage />);
    fireEvent.click(screen.getByText("Repositories"));
    expect(screen.getByTestId("repo-scanner")).toBeInTheDocument();
    expect(screen.getByTestId("repo-list")).toBeInTheDocument();
    expect(screen.queryByTestId("config-manager")).not.toBeInTheDocument();
  });

  it("switches to Search Index tab", () => {
    render(<AdminPage />);
    fireEvent.click(screen.getByText("Search Index"));
    expect(screen.getByTestId("search-manager")).toBeInTheDocument();
    expect(screen.queryByTestId("config-manager")).not.toBeInTheDocument();
  });

  it("switches back to config tab from another tab", () => {
    render(<AdminPage />);
    fireEvent.click(screen.getByText("Search Index"));
    expect(screen.getByTestId("search-manager")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Configuration"));
    expect(screen.getByTestId("config-manager")).toBeInTheDocument();
    expect(screen.queryByTestId("search-manager")).not.toBeInTheDocument();
  });
});

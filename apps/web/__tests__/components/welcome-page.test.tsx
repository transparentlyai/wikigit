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
  BookOpen: iconFactory("BookOpen"),
  GitBranch: iconFactory("GitBranch"),
  Search: iconFactory("Search"),
  Settings: iconFactory("Settings"),
  Users: iconFactory("Users"),
}));

import { WelcomePage } from "@/components/welcome/welcome-page";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WelcomePage", () => {
  it("renders the main heading", () => {
    render(<WelcomePage />);
    expect(screen.getByText("Welcome to WikiGit")).toBeInTheDocument();
  });

  it("renders the WG logo", () => {
    render(<WelcomePage />);
    expect(screen.getByText("WG")).toBeInTheDocument();
  });

  it("renders the description text", () => {
    render(<WelcomePage />);
    expect(
      screen.getByText(
        /Git-powered knowledge base for teams/,
      ),
    ).toBeInTheDocument();
  });

  it("renders all four feature cards", () => {
    render(<WelcomePage />);
    expect(screen.getByText("Git-Backed Storage")).toBeInTheDocument();
    expect(screen.getByText("Full-Text Search")).toBeInTheDocument();
    expect(screen.getByText("Markdown Editing")).toBeInTheDocument();
    expect(screen.getByText("Multi-Repository")).toBeInTheDocument();
  });

  it("renders feature descriptions", () => {
    render(<WelcomePage />);
    expect(
      screen.getByText(/stored in Git repositories with full version history/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Quickly find what you need with powerful search/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Write and edit documentation in Markdown/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Manage multiple repositories in one place/),
    ).toBeInTheDocument();
  });

  it("renders feature icons", () => {
    render(<WelcomePage />);
    expect(screen.getByTestId("icon-GitBranch")).toBeInTheDocument();
    expect(screen.getByTestId("icon-Search")).toBeInTheDocument();
    expect(screen.getByTestId("icon-BookOpen")).toBeInTheDocument();
    expect(screen.getByTestId("icon-Users")).toBeInTheDocument();
  });

  it("renders Getting Started section", () => {
    render(<WelcomePage />);
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
  });

  it("renders the three setup steps", () => {
    render(<WelcomePage />);
    expect(
      screen.getByText("Configure GitHub Integration"),
    ).toBeInTheDocument();
    expect(screen.getByText("Add Your Repositories")).toBeInTheDocument();
    expect(screen.getByText("Set Your Home Page")).toBeInTheDocument();
  });

  it("renders step descriptions", () => {
    render(<WelcomePage />);
    expect(
      screen.getByText(
        /Set up your GitHub user ID and access token/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Connect your existing GitHub repositories/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Choose an article from your repositories/,
      ),
    ).toBeInTheDocument();
  });

  it("renders the admin panel link", () => {
    render(<WelcomePage />);
    const link = screen.getByText("Go to Admin Panel");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/admin");
  });

  it("renders step numbers 1, 2, 3", () => {
    render(<WelcomePage />);
    // Step numbers are in small divs
    const stepNumbers = screen.getAllByText(/^[123]$/);
    expect(stepNumbers).toHaveLength(3);
  });
});

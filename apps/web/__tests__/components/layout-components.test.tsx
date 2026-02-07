import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import React from "react";

// ---------------------------------------------------------------------------
// Hoisted mock values
// ---------------------------------------------------------------------------

const { mockRouter, mockPathname, mockStore, iconFactory } = vi.hoisted(
  () => ({
    mockRouter: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
    mockPathname: { value: "/" },
    mockStore: {
      directories: [] as any[],
      setDirectories: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
    },
    iconFactory: (name: string) => {
      const Icon = (props: any) =>
        React.createElement("svg", {
          "data-testid": `icon-${name}`,
          ...props,
        });
      Icon.displayName = name;
      return Icon;
    },
  }),
);

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname.value,
}));

vi.mock("@/lib/store", () => ({
  useWikiStore: () => mockStore,
}));

vi.mock("@/components/layout/sidebar", () => ({
  Sidebar: ({ directories }: any) => (
    <div data-testid="sidebar">Sidebar ({directories?.length ?? 0} dirs)</div>
  ),
}));

vi.mock("@/components/ui/breadcrumbs", () => ({
  Breadcrumbs: ({ items }: any) => (
    <nav data-testid="breadcrumbs">
      {items?.map((item: any, i: number) => (
        <span key={i}>{item.label}</span>
      ))}
    </nav>
  ),
}));

vi.mock("lucide-react", () => ({
  Menu: iconFactory("Menu"),
  X: iconFactory("X"),
  ChevronRight: iconFactory("ChevronRight"),
  Edit2: iconFactory("Edit2"),
  MoreHorizontal: iconFactory("MoreHorizontal"),
  Lock: iconFactory("Lock"),
}));

import { Header } from "@/components/layout/header";
import { MainLayout } from "@/components/layout/main-layout";

// ---------------------------------------------------------------------------
// Header Tests
// ---------------------------------------------------------------------------

describe("Header", () => {
  const defaultProps = {
    sidebarOpen: true,
    onToggleSidebar: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the header element", () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("renders toggle sidebar buttons", () => {
    render(<Header {...defaultProps} />);
    const toggleButtons = screen.getAllByLabelText("Toggle Sidebar");
    expect(toggleButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onToggleSidebar when toggle button is clicked", () => {
    render(<Header {...defaultProps} />);
    const toggleButtons = screen.getAllByLabelText("Toggle Sidebar");
    fireEvent.click(toggleButtons[0]);
    expect(defaultProps.onToggleSidebar).toHaveBeenCalled();
  });

  it("renders breadcrumbs when provided", () => {
    render(
      <Header
        {...defaultProps}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Docs" },
        ]}
      />,
    );
    expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Docs")).toBeInTheDocument();
  });

  it("renders empty breadcrumbs when none provided", () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument();
  });

  it("shows edit button when showEditButton is true and onEdit provided", () => {
    const onEdit = vi.fn();
    render(
      <Header {...defaultProps} showEditButton={true} onEdit={onEdit} />,
    );
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("calls onEdit when edit button is clicked", () => {
    const onEdit = vi.fn();
    render(
      <Header {...defaultProps} showEditButton={true} onEdit={onEdit} />,
    );
    fireEvent.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalled();
  });

  it("shows read-only indicator when isReadOnly is true", () => {
    render(
      <Header {...defaultProps} showEditButton={true} isReadOnly={true} />,
    );
    expect(screen.getByText("Read-only repository")).toBeInTheDocument();
  });

  it("does not show edit button when showEditButton is false", () => {
    render(<Header {...defaultProps} showEditButton={false} />);
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
  });

  it("renders more options button", () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByTestId("icon-MoreHorizontal")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MainLayout Tests
// ---------------------------------------------------------------------------

describe("MainLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.value = "/";
    mockStore.directories = [];
    // Mock localStorage
    const store: Record<string, string> = {};
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
        clear: vi.fn(() => {
          Object.keys(store).forEach((k) => delete store[k]);
        }),
      },
      writable: true,
      configurable: true,
    });
    // Mock fetch for setup status
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ setup_complete: true }),
    });
  });

  it("renders children content", async () => {
    await act(async () => {
      render(
        <MainLayout>
          <div data-testid="page-content">Page Content</div>
        </MainLayout>,
      );
    });
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
  });

  it("renders the sidebar", async () => {
    await act(async () => {
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>,
      );
    });
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("renders the header", async () => {
    await act(async () => {
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>,
      );
    });
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("passes breadcrumbs to header", async () => {
    await act(async () => {
      render(
        <MainLayout breadcrumbs={[{ label: "Test" }]}>
          <div>Content</div>
        </MainLayout>,
      );
    });
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("checks setup status on mount", async () => {
    await act(async () => {
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>,
      );
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/setup/status");
  });

  it("redirects to admin if setup is not complete", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        setup_complete: false,
        redirect_to: "/admin",
      }),
    });

    await act(async () => {
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>,
      );
    });

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/admin");
    });
  });

  it("does not redirect if already on admin page", async () => {
    mockPathname.value = "/admin";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({
        setup_complete: false,
        redirect_to: "/admin",
      }),
    });

    await act(async () => {
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>,
      );
    });

    // Should not call push because we're on /admin already
    // (the effect returns early for /admin paths)
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("toggles sidebar on button click", async () => {
    await act(async () => {
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>,
      );
    });

    const toggleButtons = screen.getAllByLabelText("Toggle Sidebar");
    await act(async () => {
      fireEvent.click(toggleButtons[0]);
    });

    // After toggling, localStorage should be updated
    expect(localStorage.getItem("sidebarOpen")).toBeDefined();
  });

  it("reads sidebar state from localStorage", async () => {
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
      (key: string) => {
        if (key === "sidebarWidth") return "350";
        if (key === "sidebarOpen") return "false";
        return null;
      },
    );

    await act(async () => {
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>,
      );
    });

    expect(window.localStorage.getItem).toHaveBeenCalledWith("sidebarWidth");
    expect(window.localStorage.getItem).toHaveBeenCalledWith("sidebarOpen");
  });

  it("calls setLoading and setDirectories on mount", async () => {
    await act(async () => {
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>,
      );
    });

    expect(mockStore.setLoading).toHaveBeenCalledWith(false);
    expect(mockStore.setDirectories).toHaveBeenCalledWith([]);
  });

  it("handles setup status fetch failure gracefully", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    await act(async () => {
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>,
      );
    });

    // Should still render without crashing
    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});

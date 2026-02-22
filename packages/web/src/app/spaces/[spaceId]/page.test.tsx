import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import SpaceDetailPage from "./page";

let currentRole: "owner" | "admin" | "member" = "owner";
const mockInstallMutate = vi.fn();
const mockUninstallMutate = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ spaceId: "space-1" }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useActiveOrganization: () => ({ data: { id: "org-1" } }),
    useSession: () => ({ data: { user: { id: "user-1" } } }),
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      spaces: {
        get: { invalidate: vi.fn() },
        apps: {
          listInstalled: { invalidate: vi.fn() },
          catalog: { invalidate: vi.fn() },
        },
      },
    }),
    organizations: {
      members: {
        useQuery: () => ({
          data: [{ userId: "user-1", role: currentRole }],
        }),
      },
    },
    spaces: {
      get: {
        useQuery: () => ({
          data: {
            id: "space-1",
            name: "Space One",
            description: "A test space",
            createdBy: { name: "Tester" },
            createdAt: new Date().toISOString(),
            tasks: [],
          },
          isLoading: false,
          error: null,
        }),
      },
      tasks: {
        delete: {
          useMutation: () => ({ mutate: vi.fn() }),
        },
      },
      apps: {
        listInstalled: {
          useQuery: () => ({
            data: [
              {
                id: "install-1",
                app: {
                  id: "app-1",
                  name: "Coding Agent",
                  description: "Agent",
                  navigation: ["memory/view", "memory-edit"],
                },
              },
            ],
          }),
        },
        catalog: {
          useQuery: () => ({
            data: [
              {
                id: "app-2",
                name: "Chat",
                description: "Chat app",
                installed: false,
                enabled: true,
                navigation: ["chats"],
              },
            ],
          }),
        },
        install: {
          useMutation: () => ({
            mutate: mockInstallMutate,
          }),
        },
        uninstall: {
          useMutation: () => ({
            mutate: mockUninstallMutate,
          }),
        },
      },
    },
  },
}));

describe("Space apps UI", () => {
  beforeEach(() => {
    cleanup();
    mockInstallMutate.mockReset();
    mockUninstallMutate.mockReset();
    currentRole = "owner";
  });

  it("renders apps and allows install/uninstall for admins", () => {
    render(<SpaceDetailPage />);

    expect(screen.getByText("Apps")).toBeTruthy();
    expect(screen.getByText("Installed")).toBeTruthy();
    expect(screen.getByText("Available Apps")).toBeTruthy();

    fireEvent.click(screen.getByText("Install"));
    expect(mockInstallMutate).toHaveBeenCalledWith({
      spaceId: "space-1",
      appId: "app-2",
    });

    fireEvent.click(screen.getByText("Uninstall"));
    expect(mockUninstallMutate).toHaveBeenCalledWith({
      spaceId: "space-1",
      appId: "app-1",
    });
  });

  it("hides edit navigation for non-admin members", () => {
    currentRole = "member";
    render(<SpaceDetailPage />);

    expect(screen.getAllByText("memory/view").length).toBeGreaterThan(0);
    expect(screen.queryByText("memory-edit")).toBeNull();
  });
});

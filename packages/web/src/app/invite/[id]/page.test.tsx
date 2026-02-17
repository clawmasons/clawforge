import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "test-invite-id" }),
  useRouter: () => ({ push: mockPush }),
}));

const {
  mockSignInSocial,
  mockSignOut,
  mockAcceptInvitation,
  mockSetActive,
  mockUseSession,
} = vi.hoisted(() => ({
  mockSignInSocial: vi.fn(),
  mockSignOut: vi.fn().mockResolvedValue(undefined),
  mockAcceptInvitation: vi.fn().mockResolvedValue({}),
  mockSetActive: vi.fn().mockResolvedValue({}),
  mockUseSession: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSession(...args),
    signIn: { social: mockSignInSocial },
    signOut: (...args: unknown[]) => mockSignOut(...args),
    organization: {
      acceptInvitation: mockAcceptInvitation,
      setActive: mockSetActive,
    },
  },
}));

const mockUseQuery = vi.hoisted(() => vi.fn());
vi.mock("@/lib/trpc", () => ({
  trpc: {
    invitations: {
      get: {
        useQuery: (...args: unknown[]) => mockUseQuery(...args),
      },
    },
  },
}));

import InviteAcceptPage from "./page";

const pendingInvite = {
  id: "test-invite-id",
  email: "new@acme.com",
  role: "member",
  status: "pending",
  expiresAt: new Date("2099-12-31"),
  organization: { name: "Acme Corp", slug: "acme-corp", logo: null },
};

describe("InviteAcceptPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({ data: null });
    mockUseQuery.mockReturnValue({
      data: pendingInvite,
      isLoading: false,
      error: null,
    });
  });

  it("uses absolute callbackURL when signing in unauthenticated", async () => {
    render(<InviteAcceptPage />);

    const btn = await screen.findByText("Sign in with Google to Accept");
    fireEvent.click(btn);

    expect(mockSignInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: `${window.location.origin}/invite/test-invite-id`,
    });
  });

  it("uses absolute callbackURL when signing in with different account", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { email: "wrong@other.com" } },
    });

    render(<InviteAcceptPage />);

    const btn = await screen.findByText("Sign in with a Different Account");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockSignInSocial).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: `${window.location.origin}/invite/test-invite-id`,
      });
    });
  });

  it("shows accept button when authenticated with matching email", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { email: "new@acme.com" } },
    });

    render(<InviteAcceptPage />);

    const btn = await screen.findByText("Accept Invitation");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockAcceptInvitation).toHaveBeenCalledWith({
        invitationId: "test-invite-id",
      });
    });
  });

  it("shows expired state for expired invitations", async () => {
    mockUseQuery.mockReturnValue({
      data: { ...pendingInvite, status: "expired" },
      isLoading: false,
      error: null,
    });

    render(<InviteAcceptPage />);

    await screen.findByText("This invitation has expired.");
  });

  it("shows not found for missing invitation", async () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Not found"),
    });

    render(<InviteAcceptPage />);

    await screen.findByText("Invitation Not Found");
  });
});

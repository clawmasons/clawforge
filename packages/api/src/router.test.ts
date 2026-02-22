import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "crypto";

// Flexible mock DB that supports configurable query results
let queryResults: unknown[][] = [];
let queryIndex = 0;

function nextResult() {
  return queryResults[queryIndex++] ?? [];
}

// Terminal query node: supports .then() and .orderBy().then()
function makeTerminal() {
  const result = nextResult();
  return {
    then: (fn: (rows: unknown[]) => unknown) =>
      Promise.resolve(fn(result)),
    orderBy: (..._oArgs: unknown[]) => ({
      then: (fn: (rows: unknown[]) => unknown) =>
        Promise.resolve(fn(result)),
    }),
  };
}

const { mockInsert, mockValues, mockUpdate, mockSet, mockDelete, mockCreateInvitation } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockDelete: vi.fn(),
  mockCreateInvitation: vi.fn(),
}));

vi.mock("./db/index.js", () => ({
  db: {
    select: (..._args: unknown[]) => ({
      from: (..._fArgs: unknown[]) => {
        const fromObj = {
          where: (..._wArgs: unknown[]) => makeTerminal(),
          innerJoin: (..._jArgs: unknown[]) => ({
            where: (..._wArgs: unknown[]) => makeTerminal(),
          }),
          // Make from() thenable for queries without .where()
          then: (resolve: (v: unknown) => void) =>
            resolve(nextResult()),
        };
        return fromObj;
      },
    }),
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...vArgs: unknown[]) => {
          mockValues(...vArgs);
          return Promise.resolve();
        },
      };
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...sArgs: unknown[]) => {
          mockSet(...sArgs);
          return {
            where: () => Promise.resolve(),
          };
        },
      };
    },
    delete: (...args: unknown[]) => {
      mockDelete(...args);
      return {
        where: () => Promise.resolve(),
      };
    },
  },
}));

vi.mock("./lib/token.js", () => ({
  generateApiToken: () => ({
    raw: "clf_test-token-raw-value",
    hash: "test-hash-value",
    prefix: "clf_test-tok",
  }),
}));

vi.mock("./auth.js", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
      createInvitation: mockCreateInvitation,
    },
  },
}));

import { appRouter } from "./router.js";

function makeUser(overrides: { id: string; name: string; email: string }) {
  return {
    ...overrides,
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerified: true,
    image: null,
  };
}

function createCaller(
  partial: { id: string; name: string; email: string } | null,
  activeOrganizationId: string | null = null,
) {
  const user = partial ? makeUser(partial) : null;
  return appRouter.createCaller({
    session: user
      ? {
          id: randomUUID(),
          token: "test",
          userId: user.id,
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ipAddress: null,
          userAgent: null,
          activeOrganizationId,
        }
      : null,
    user,
  });
}

const testUser = { id: "user-1", name: "Test User", email: "test@acme.com" };
const testUser2 = {
  id: "user-2",
  name: "Other User",
  email: "other@acme.com",
};

describe("organizations.myOrganizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("returns domain orgs for the user", async () => {
    const caller = createCaller(testUser);
    const orgData = [
      { id: "org-1", name: "Acme Corp", slug: "acme-corp", logo: null },
    ];
    // Query 1: innerJoin result
    queryResults = [orgData];

    const result = await caller.organizations.myOrganizations();
    expect(result).toEqual(orgData);
  });

  it("throws UNAUTHORIZED if not authenticated", async () => {
    const caller = createCaller(null);

    await expect(
      caller.organizations.myOrganizations(),
    ).rejects.toThrow(/UNAUTHORIZED/);
  });
});

describe("organizations.members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("returns member list for authorized caller", async () => {
    const caller = createCaller(testUser);
    const memberData = [
      {
        id: "m1",
        role: "owner",
        createdAt: new Date(),
        userId: testUser.id,
        userName: "Test User",
        userEmail: "test@acme.com",
        userImage: null,
      },
    ];
    // Query 1: caller membership check -> found
    // Query 2: member list (via innerJoin) -> member data
    queryResults = [[{ id: "m1", role: "owner" }], memberData];

    const result = await caller.organizations.members({
      organizationId: "org-1",
    });
    expect(result).toEqual(memberData);
  });

  it("throws FORBIDDEN if caller is not a member", async () => {
    const caller = createCaller(testUser2);
    // Query 1: caller membership check -> not found
    queryResults = [[]];

    await expect(
      caller.organizations.members({ organizationId: "org-1" }),
    ).rejects.toThrow(/not a member/);
  });

  it("throws UNAUTHORIZED if not authenticated", async () => {
    const caller = createCaller(null);

    await expect(
      caller.organizations.members({ organizationId: "org-1" }),
    ).rejects.toThrow(/UNAUTHORIZED/);
  });
});

describe("organizations.tokens.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("creates token and returns raw value for owner", async () => {
    const caller = createCaller(testUser);
    // Query 1: verifyOrgOwner membership check -> owner
    queryResults = [[{ role: "owner" }]];

    const result = await caller.organizations.tokens.create({
      organizationId: "org-1",
      label: "CI Token",
    });

    expect(result.token).toBe("clf_test-token-raw-value");
    expect(result.label).toBe("CI Token");
    expect(result.tokenPrefix).toBe("clf_test-tok");
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "CI Token",
        tokenHash: "test-hash-value",
        tokenPrefix: "clf_test-tok",
        organizationId: "org-1",
        createdBy: testUser.id,
      }),
    );
  });

  it("throws FORBIDDEN for non-owner", async () => {
    const caller = createCaller(testUser2);
    // Query 1: verifyOrgOwner -> member (not owner)
    queryResults = [[{ role: "member" }]];

    await expect(
      caller.organizations.tokens.create({
        organizationId: "org-1",
        label: "CI Token",
      }),
    ).rejects.toThrow(/owners/);
  });

  it("throws UNAUTHORIZED if not authenticated", async () => {
    const caller = createCaller(null);

    await expect(
      caller.organizations.tokens.create({
        organizationId: "org-1",
        label: "CI Token",
      }),
    ).rejects.toThrow(/UNAUTHORIZED/);
  });
});

describe("organizations.tokens.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("returns tokens for owner", async () => {
    const caller = createCaller(testUser);
    const tokenData = [
      {
        id: "tok-1",
        label: "CI Token",
        tokenPrefix: "clf_abc12345",
        enabled: true,
        createdAt: new Date(),
        lastUsedAt: null,
      },
    ];
    // Query 1: verifyOrgOwner -> owner
    // Query 2: token list (from().where()) -> tokens
    queryResults = [[{ role: "owner" }], tokenData];

    const result = await caller.organizations.tokens.list({
      organizationId: "org-1",
    });
    expect(result).toEqual(tokenData);
  });

  it("throws FORBIDDEN for non-owner", async () => {
    const caller = createCaller(testUser2);
    // Query 1: verifyOrgOwner -> not found
    queryResults = [[]];

    await expect(
      caller.organizations.tokens.list({ organizationId: "org-1" }),
    ).rejects.toThrow(/owners/);
  });
});

describe("organizations.tokens.delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("deletes token for owner", async () => {
    const caller = createCaller(testUser);
    // Query 1: verifyOrgOwner -> owner
    // Query 2: find token -> found
    queryResults = [[{ role: "owner" }], [{ id: "tok-1" }]];

    const result = await caller.organizations.tokens.delete({
      organizationId: "org-1",
      tokenId: "tok-1",
    });
    expect(result).toEqual({ ok: true });
    expect(mockDelete).toHaveBeenCalled();
  });

  it("throws NOT_FOUND for missing token", async () => {
    const caller = createCaller(testUser);
    // Query 1: verifyOrgOwner -> owner
    // Query 2: find token -> not found
    queryResults = [[{ role: "owner" }], []];

    await expect(
      caller.organizations.tokens.delete({
        organizationId: "org-1",
        tokenId: "tok-missing",
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("organizations.tokens.toggleEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("toggles token enabled state for owner", async () => {
    const caller = createCaller(testUser);
    // Query 1: verifyOrgOwner -> owner
    // Query 2: find token -> found
    queryResults = [[{ role: "owner" }], [{ id: "tok-1" }]];

    const result = await caller.organizations.tokens.toggleEnabled({
      organizationId: "org-1",
      tokenId: "tok-1",
      enabled: false,
    });
    expect(result).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ enabled: false });
  });
});

// ─── Invitation Tests ────────────────────────────────────────────────────────

describe("invitations.get", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("returns invitation with org details", async () => {
    const caller = createCaller(null); // public procedure
    const futureDate = new Date("2099-12-31T00:00:00Z");
    // Query 1: innerJoin(organization).where(id).then(rows => rows[0])
    queryResults = [[{
      id: "inv-1",
      email: "new@acme.com",
      role: "member",
      status: "pending",
      expiresAt: futureDate,
      orgName: "Acme Corp",
      orgSlug: "acme-corp",
      orgLogo: null,
    }]];

    const result = await caller.invitations.get({ id: "inv-1" });
    expect(result).toEqual({
      id: "inv-1",
      email: "new@acme.com",
      role: "member",
      status: "pending",
      expiresAt: futureDate,
      organization: {
        name: "Acme Corp",
        slug: "acme-corp",
        logo: null,
      },
    });
  });

  it("throws NOT_FOUND for missing invitation", async () => {
    const caller = createCaller(null);
    // Query 1: innerJoin returns empty
    queryResults = [[]];

    await expect(
      caller.invitations.get({ id: "inv-missing" }),
    ).rejects.toThrow(/not found/i);
  });

  it("marks expired pending invitation via lazy expiration", async () => {
    const caller = createCaller(null);
    const pastDate = new Date("2020-01-01T00:00:00Z");
    // Query 1: invitation found, pending but past expiresAt
    queryResults = [[{
      id: "inv-1",
      email: "new@acme.com",
      role: "member",
      status: "pending",
      expiresAt: pastDate,
      orgName: "Acme Corp",
      orgSlug: "acme-corp",
      orgLogo: null,
    }]];

    const result = await caller.invitations.get({ id: "inv-1" });
    expect(result.status).toBe("expired");
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ status: "expired" });
  });

  it("does not update non-expired pending invitation", async () => {
    const caller = createCaller(null);
    const futureDate = new Date("2099-12-31T00:00:00Z");
    queryResults = [[{
      id: "inv-1",
      email: "new@acme.com",
      role: "member",
      status: "pending",
      expiresAt: futureDate,
      orgName: "Acme Corp",
      orgSlug: "acme-corp",
      orgLogo: null,
    }]];

    const result = await caller.invitations.get({ id: "inv-1" });
    expect(result.status).toBe("pending");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("invitations.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("returns pending invitations for org admin", async () => {
    const caller = createCaller(testUser, "org-1");
    const now = new Date();
    // Query 1: verifyOrgAdmin → admin
    // (db.update for lazy expiration — mockUpdate, no queryResults consumed)
    // Query 2: innerJoin(user).where().orderBy() → invitation rows
    queryResults = [
      [{ role: "admin" }],
      [{
        id: "inv-1",
        email: "new@acme.com",
        role: "member",
        status: "pending",
        expiresAt: new Date("2099-12-31"),
        createdAt: now,
        inviterId: "user-1",
        inviterName: "Test User",
        inviterImage: null,
      }],
    ];

    const result = await caller.invitations.list();
    expect(result).toEqual([{
      id: "inv-1",
      email: "new@acme.com",
      role: "member",
      status: "pending",
      expiresAt: new Date("2099-12-31"),
      createdAt: now,
      inviter: {
        id: "user-1",
        name: "Test User",
        image: null,
      },
    }]);
  });

  it("throws UNAUTHORIZED without active org", async () => {
    const caller = createCaller(testUser); // no activeOrganizationId

    await expect(
      caller.invitations.list(),
    ).rejects.toThrow(/No active organization/);
  });

  it("throws FORBIDDEN for non-admin", async () => {
    const caller = createCaller(testUser, "org-1");
    // Query 1: verifyOrgAdmin → member (not admin/owner)
    queryResults = [[{ role: "member" }]];

    await expect(
      caller.invitations.list(),
    ).rejects.toThrow(/admins and owners/);
  });

  it("throws UNAUTHORIZED if not authenticated", async () => {
    const caller = createCaller(null);

    await expect(
      caller.invitations.list(),
    ).rejects.toThrow(/UNAUTHORIZED/);
  });
});

describe("invitations.resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("cancels old invitation, creates new, returns new invitation", async () => {
    const caller = createCaller(testUser, "org-1");
    const newExpiry = new Date("2099-12-31T00:00:00Z");
    // Query 1: verifyOrgAdmin → admin
    // Query 2: select existing invitation → found, pending, same org
    // (db.update to cancel — mockUpdate)
    // (auth.api.createInvitation — mock)
    // Query 3: select new invitation → found
    queryResults = [
      [{ role: "admin" }],
      [{
        id: "inv-old",
        email: "new@acme.com",
        role: "member",
        status: "pending",
        expiresAt: new Date("2099-12-31"),
        organizationId: "org-1",
      }],
      [{
        id: "inv-new",
        email: "new@acme.com",
        expiresAt: newExpiry,
      }],
    ];

    const result = await caller.invitations.resend({ invitationId: "inv-old" });
    expect(result).toEqual({
      id: "inv-new",
      email: "new@acme.com",
      expiresAt: newExpiry,
    });
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ status: "canceled" });
    expect(mockCreateInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          email: "new@acme.com",
          role: "member",
          organizationId: "org-1",
        },
      }),
    );
  });

  it("allows resend for expired invitations", async () => {
    const caller = createCaller(testUser, "org-1");
    queryResults = [
      [{ role: "admin" }],
      [{
        id: "inv-old",
        email: "new@acme.com",
        role: "admin",
        status: "expired",
        expiresAt: new Date("2020-01-01"),
        organizationId: "org-1",
      }],
      [{
        id: "inv-new",
        email: "new@acme.com",
        expiresAt: new Date("2099-12-31"),
      }],
    ];

    const result = await caller.invitations.resend({ invitationId: "inv-old" });
    expect(result.id).toBe("inv-new");
    expect(mockCreateInvitation).toHaveBeenCalled();
  });

  it("allows resend for lazily-expired (pending + past expiresAt)", async () => {
    const caller = createCaller(testUser, "org-1");
    queryResults = [
      [{ role: "admin" }],
      [{
        id: "inv-old",
        email: "new@acme.com",
        role: "member",
        status: "pending",
        expiresAt: new Date("2020-01-01"), // past — lazily expired
        organizationId: "org-1",
      }],
      [{
        id: "inv-new",
        email: "new@acme.com",
        expiresAt: new Date("2099-12-31"),
      }],
    ];

    const result = await caller.invitations.resend({ invitationId: "inv-old" });
    expect(result.id).toBe("inv-new");
  });

  it("rejects resend for accepted invitation", async () => {
    const caller = createCaller(testUser, "org-1");
    queryResults = [
      [{ role: "admin" }],
      [{
        id: "inv-old",
        email: "new@acme.com",
        role: "member",
        status: "accepted",
        expiresAt: new Date("2099-12-31"),
        organizationId: "org-1",
      }],
    ];

    await expect(
      caller.invitations.resend({ invitationId: "inv-old" }),
    ).rejects.toThrow(/pending or expired/);
  });

  it("throws NOT_FOUND if invitation belongs to different org", async () => {
    const caller = createCaller(testUser, "org-1");
    queryResults = [
      [{ role: "admin" }],
      [{
        id: "inv-old",
        email: "new@acme.com",
        role: "member",
        status: "pending",
        expiresAt: new Date("2099-12-31"),
        organizationId: "org-other",
      }],
    ];

    await expect(
      caller.invitations.resend({ invitationId: "inv-old" }),
    ).rejects.toThrow(/not found/i);
  });

  it("throws NOT_FOUND for missing invitation", async () => {
    const caller = createCaller(testUser, "org-1");
    queryResults = [
      [{ role: "admin" }],
      [], // no invitation found
    ];

    await expect(
      caller.invitations.resend({ invitationId: "inv-missing" }),
    ).rejects.toThrow(/not found/i);
  });

  it("throws INTERNAL_SERVER_ERROR if new invitation not found after creation", async () => {
    const caller = createCaller(testUser, "org-1");
    queryResults = [
      [{ role: "admin" }],
      [{
        id: "inv-old",
        email: "new@acme.com",
        role: "member",
        status: "pending",
        expiresAt: new Date("2099-12-31"),
        organizationId: "org-1",
      }],
      [], // new invitation not found
    ];

    await expect(
      caller.invitations.resend({ invitationId: "inv-old" }),
    ).rejects.toThrow(/Failed to create/);
  });
});

describe("spaces.apps.catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("seeds default apps when missing", async () => {
    const caller = createCaller(testUser, "org-1");
    queryResults = [
      [{ id: "member-1" }],
      [],
      [],
      [{ id: "space-1", organizationId: "org-1" }],
      [{ id: "member-1" }],
      [{
        id: "app-chat",
        name: "Chat",
        slug: "chat",
        description: "desc",
        enabled: true,
        navigation: JSON.stringify(["chats"]),
        subspacePath: "private.chat",
        appDefinition: JSON.stringify({ setup: "setup" }),
        taskDefinitions: JSON.stringify([]),
      }],
    ];

    await caller.spaces.apps.catalog({ spaceId: "space-1" });
    expect(mockInsert).toHaveBeenCalledTimes(2);
    const insertedSubspacePaths = mockValues.mock.calls
      .map(([v]) => (v as { subspacePath?: string }).subspacePath)
      .filter((v): v is string => typeof v === "string");
    expect(new Set(insertedSubspacePaths).size).toBe(insertedSubspacePaths.length);
  });

  it("does not reseed defaults when apps already exist", async () => {
    const caller = createCaller(testUser, "org-1");
    queryResults = [
      [{ id: "member-1" }],
      [{ id: "app-chat" }],
      [{ id: "app-coding-agent" }],
      [{ id: "space-1", organizationId: "org-1" }],
      [{ id: "member-1" }],
      [{
        id: "app-chat",
        name: "Chat",
        slug: "chat",
        description: "desc",
        enabled: true,
        navigation: JSON.stringify(["chats"]),
        subspacePath: "private.chat",
        appDefinition: JSON.stringify({ setup: "setup" }),
        taskDefinitions: JSON.stringify([]),
      }],
    ];

    await caller.spaces.apps.catalog({ spaceId: "space-1" });
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("spaces.apps.install", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("rejects install for non-admin space member", async () => {
    const caller = createCaller(testUser, "org-1");
    queryResults = [
      [{ organizationId: "org-1" }],
      [{ role: "member" }],
      [{ role: "member" }],
    ];

    await expect(
      caller.spaces.apps.install({ spaceId: "space-1", appSlug: "chat" }),
    ).rejects.toThrow(/space admins and owners/i);
  });

  it("creates install and default task using fallback owner and trigger metadata", async () => {
    const caller = createCaller(testUser, "org-1");
    queryResults = [
      [{ organizationId: "org-1" }],
      [{ role: "admin" }],
      [{ id: "seed-chat" }],
      [{ id: "seed-coding-agent" }],
      [{
        id: "app-chat",
        slug: "chat",
        enabled: true,
        organizationId: "org-1",
        appDefinition: JSON.stringify({ setup: "setup prompt" }),
        taskDefinitions: JSON.stringify([
          {
            name: "triage",
            enabled: true,
            requiredRoles: ["member"],
            triggerEvents: [{ event: "memory-update", path: "memory" }],
          },
        ]),
      }],
      [],
      [{ userId: "member-1", role: "member" }],
      [],
    ];

    const result = await caller.spaces.apps.install({
      spaceId: "space-1",
      appSlug: "chat",
    });

    expect(result.appSlug).toBe("chat");
    expect(
      mockValues.mock.calls.some(
        ([v]) =>
          typeof v === "object" &&
          v !== null &&
          "spaceId" in (v as Record<string, unknown>) &&
          (v as Record<string, unknown>).spaceId === "space-1" &&
          (v as Record<string, unknown>).appId === "app-chat",
      ),
    ).toBe(true);
    expect(
      mockValues.mock.calls.some(
        ([v]) =>
          typeof v === "object" &&
          v !== null &&
          "name" in (v as Record<string, unknown>) &&
          (v as Record<string, unknown>).name === "chat-triage" &&
          (v as Record<string, unknown>).createdBy === "member-1" &&
          (v as Record<string, unknown>).plan === "setup prompt" &&
          (v as Record<string, unknown>).triggers ===
            JSON.stringify(["memory-update:memory"]),
      ),
    ).toBe(true);
  });
});

describe("spaces.apps.uninstall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("uninstalls app from a space for admin", async () => {
    const caller = createCaller(testUser, "org-1");
    queryResults = [
      [{ organizationId: "org-1" }],
      [{ role: "admin" }],
      [{
        id: "install-1",
        appId: "app-chat",
        appSlug: "chat",
        appOrgId: "org-1",
      }],
    ];

    const result = await caller.spaces.apps.uninstall({
      spaceId: "space-1",
      appSlug: "chat",
    });
    expect(result).toEqual({ ok: true, appId: "app-chat", appSlug: "chat" });
    expect(mockDelete).toHaveBeenCalled();
  });

  it("rejects uninstall when install belongs to a different organization", async () => {
    const caller = createCaller(testUser, "org-1");
    queryResults = [
      [{ organizationId: "org-1" }],
      [{ role: "admin" }],
      [{
        id: "install-1",
        appId: "app-chat",
        appSlug: "chat",
        appOrgId: "org-2",
      }],
    ];

    await expect(
      caller.spaces.apps.uninstall({ spaceId: "space-1", appSlug: "chat" }),
    ).rejects.toThrow(/not found/i);
  });
});

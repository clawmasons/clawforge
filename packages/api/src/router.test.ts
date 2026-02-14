import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "crypto";

// Flexible mock DB that supports configurable query results
let queryResults: unknown[][] = [];
let queryIndex = 0;

function nextResult() {
  return queryResults[queryIndex++] ?? [];
}

const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();

vi.mock("./db/index.js", () => ({
  db: {
    select: (..._args: unknown[]) => ({
      from: (..._fArgs: unknown[]) => {
        const fromObj = {
          where: (..._wArgs: unknown[]) => ({
            then: (fn: (rows: unknown[]) => unknown) =>
              Promise.resolve(fn(nextResult())),
          }),
          innerJoin: (..._jArgs: unknown[]) => ({
            where: (..._wArgs: unknown[]) =>
              Promise.resolve(nextResult()),
          }),
          // Make from() thenable for queries without .where() (e.g. listLaunched)
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

// Mock auth
vi.mock("./auth.js", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
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

describe("programs.launch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("inserts program on success", async () => {
    const caller = createCaller(testUser, "org-1");
    // Query 1: check existing program -> not found
    queryResults = [[]];

    const result = await caller.programs.launch({ programId: "help-desk" });

    expect(result.success).toBe(true);
    expect(result.programId).toBeDefined();
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        programId: "help-desk",
        organizationId: "org-1",
        launchedBy: testUser.id,
      }),
    );
  });

  it("throws CONFLICT if program already launched", async () => {
    const caller = createCaller(testUser, "org-1");
    // Query 1: check existing program -> found
    queryResults = [[{ id: "p-1", programId: "help-desk" }]];

    await expect(
      caller.programs.launch({ programId: "help-desk" }),
    ).rejects.toThrow(/already been launched/);
  });

  it("throws BAD_REQUEST if no active org", async () => {
    const caller = createCaller(testUser);
    // No activeOrganizationId

    await expect(
      caller.programs.launch({ programId: "help-desk" }),
    ).rejects.toThrow(/No active organization/);
  });

  it("throws UNAUTHORIZED if not authenticated", async () => {
    const caller = createCaller(null);

    await expect(
      caller.programs.launch({ programId: "help-desk" }),
    ).rejects.toThrow(/UNAUTHORIZED/);
  });
});

describe("programs.join", () => {
  it("throws NOT_IMPLEMENTED", async () => {
    const caller = createCaller(testUser);

    await expect(
      caller.programs.join({ programId: "help-desk" }),
    ).rejects.toThrow(/not yet implemented/);
  });

  it("throws UNAUTHORIZED if not authenticated", async () => {
    const caller = createCaller(null);

    await expect(
      caller.programs.join({ programId: "help-desk" }),
    ).rejects.toThrow(/UNAUTHORIZED/);
  });
});

describe("programs.listLaunched", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("returns program IDs from program table", async () => {
    const caller = createCaller(null);
    // select().from(program) — no .where(), resolved via thenable mock
    queryResults = [
      [{ programId: "help-desk" }, { programId: "slack-word-game" }],
    ];

    const result = await caller.programs.listLaunched();
    expect(result).toEqual(["help-desk", "slack-word-game"]);
  });
});

describe("programs.myMemberships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("returns programs for orgs the user belongs to", async () => {
    const caller = createCaller(testUser);
    // Query 1: innerJoin result
    queryResults = [
      [
        { programId: "help-desk", role: "owner" },
        { programId: "slack-word-game", role: "member" },
      ],
    ];

    const result = await caller.programs.myMemberships();
    expect(result).toEqual([
      { programId: "help-desk", role: "owner" },
      { programId: "slack-word-game", role: "member" },
    ]);
  });

  it("throws UNAUTHORIZED if not authenticated", async () => {
    const caller = createCaller(null);

    await expect(caller.programs.myMemberships()).rejects.toThrow(
      /UNAUTHORIZED/,
    );
  });
});

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

describe("organizations.programs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("returns programs for the org", async () => {
    const caller = createCaller(testUser);
    const programData = [
      {
        id: "p-1",
        programId: "help-desk",
        launchedBy: "user-1",
        createdAt: new Date(),
      },
    ];
    // Query 1: membership check -> found
    // Query 2: program list (from().where()) -> programs
    queryResults = [[{ id: "m-1", role: "owner" }], programData];

    const result = await caller.organizations.programs({
      organizationId: "org-1",
    });
    expect(result).toEqual(programData);
  });

  it("throws FORBIDDEN if caller is not a member", async () => {
    const caller = createCaller(testUser2);
    // Query 1: membership check -> not found
    queryResults = [[]];

    await expect(
      caller.organizations.programs({ organizationId: "org-1" }),
    ).rejects.toThrow(/not a member/);
  });

  it("throws UNAUTHORIZED if not authenticated", async () => {
    const caller = createCaller(null);

    await expect(
      caller.organizations.programs({ organizationId: "org-1" }),
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

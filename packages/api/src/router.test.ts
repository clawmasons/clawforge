import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "crypto";

// Flexible mock DB that supports configurable query results
let queryResults: unknown[][] = [];
let queryIndex = 0;

function nextResult() {
  return queryResults[queryIndex++] ?? [];
}

const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockSetValues = vi.fn();

vi.mock("./db/index.js", () => ({
  db: {
    select: (..._args: unknown[]) => ({
      from: (..._fArgs: unknown[]) => ({
        where: (..._wArgs: unknown[]) => ({
          then: (fn: (rows: unknown[]) => unknown) =>
            Promise.resolve(fn(nextResult())),
        }),
        innerJoin: (..._jArgs: unknown[]) => ({
          where: (..._wArgs: unknown[]) =>
            Promise.resolve(nextResult()),
        }),
      }),
    }),
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...sArgs: unknown[]) => {
          mockSetValues(...sArgs);
          return {
            where: () => Promise.resolve(),
          };
        },
      };
    },
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return {
        values: (...vArgs: unknown[]) => {
          mockValues(...vArgs);
          return Promise.resolve();
        },
      };
    },
  },
}));

// Mock auth
const mockCreateOrganization = vi.fn();
vi.mock("./auth.js", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
      createOrganization: (...args: unknown[]) =>
        mockCreateOrganization(...args),
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
          activeOrganizationId: null,
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

  it("creates org and sets programId on success", async () => {
    const caller = createCaller(testUser);
    const orgId = randomUUID();
    // Query 1: check existing org for programId -> not found
    queryResults = [[]];
    mockCreateOrganization.mockResolvedValue({
      id: orgId,
      name: "help-desk",
      slug: "program-help-desk",
    });

    const result = await caller.programs.launch({ programId: "help-desk" });

    expect(result.success).toBe(true);
    expect(result.organizationId).toBe(orgId);
    expect(mockCreateOrganization).toHaveBeenCalledWith({
      body: {
        name: "help-desk",
        slug: "program-help-desk",
        userId: testUser.id,
      },
    });
    expect(mockSetValues).toHaveBeenCalledWith({ programId: "help-desk" });
  });

  it("throws CONFLICT if program already launched", async () => {
    const caller = createCaller(testUser);
    // Query 1: check existing org -> found
    queryResults = [[{ id: "org-1", programId: "help-desk" }]];

    await expect(
      caller.programs.launch({ programId: "help-desk" }),
    ).rejects.toThrow(/already been launched/);
  });

  it("throws UNAUTHORIZED if not authenticated", async () => {
    const caller = createCaller(null);

    await expect(
      caller.programs.launch({ programId: "help-desk" }),
    ).rejects.toThrow(/UNAUTHORIZED/);
  });
});

describe("programs.join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;
  });

  it("adds user as member on success", async () => {
    const caller = createCaller(testUser2);
    const orgId = "org-1";
    // Query 1: find org by programId -> found
    // Query 2: check existing membership -> not found
    queryResults = [
      [{ id: orgId, programId: "help-desk" }],
      [],
    ];

    const result = await caller.programs.join({ programId: "help-desk" });

    expect(result.success).toBe(true);
    expect(result.organizationId).toBe(orgId);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: orgId,
        userId: testUser2.id,
        role: "member",
      }),
    );
  });

  it("throws NOT_FOUND if program not launched", async () => {
    const caller = createCaller(testUser2);
    // Query 1: find org -> not found
    queryResults = [[]];

    await expect(
      caller.programs.join({ programId: "nonexistent" }),
    ).rejects.toThrow(/not been launched/);
  });

  it("throws CONFLICT if already a member", async () => {
    const caller = createCaller(testUser2);
    // Query 1: find org -> found
    // Query 2: check membership -> found
    queryResults = [
      [{ id: "org-1", programId: "help-desk" }],
      [{ id: "member-1" }],
    ];

    await expect(
      caller.programs.join({ programId: "help-desk" }),
    ).rejects.toThrow(/already a member/);
  });

  it("throws UNAUTHORIZED if not authenticated", async () => {
    const caller = createCaller(null);

    await expect(
      caller.programs.join({ programId: "help-desk" }),
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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSendEmail = vi.hoisted(() => vi.fn());

vi.mock("./lib/email.js", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("./db/index.js", () => ({
  db: {},
}));

import {
  isPersonalEmail,
  buildOrgDetails,
  PERSONAL_DOMAINS,
  sendInvitationEmail,
} from "./auth.js";

describe("isPersonalEmail", () => {
  it("returns true for gmail.com", () => {
    expect(isPersonalEmail("alice@gmail.com")).toBe(true);
  });

  it("returns true for all listed personal domains", () => {
    for (const domain of PERSONAL_DOMAINS) {
      expect(isPersonalEmail(`user@${domain}`)).toBe(true);
    }
  });

  it("returns false for corporate domains", () => {
    expect(isPersonalEmail("alice@acme.com")).toBe(false);
    expect(isPersonalEmail("bob@company.co.uk")).toBe(false);
  });

  it("is case-insensitive on the domain", () => {
    expect(isPersonalEmail("user@Gmail.COM")).toBe(true);
    expect(isPersonalEmail("user@OUTLOOK.COM")).toBe(true);
  });

  it("returns false for empty or malformed input", () => {
    expect(isPersonalEmail("nodomain")).toBe(false);
    expect(isPersonalEmail("")).toBe(false);
  });
});

describe("buildOrgDetails", () => {
  it("uses '<name> Forge' for personal email", () => {
    const org = buildOrgDetails("alice@gmail.com", "Alice Smith");
    expect(org.name).toBe("Alice Smith Forge");
    expect(org.slug).toBe("alice-smith-forge");
  });

  it("uses domain for corporate email", () => {
    const org = buildOrgDetails("alice@acme.com", "Alice Smith");
    expect(org.name).toBe("acme.com");
    expect(org.slug).toBe("acme-com");
  });

  it("collapses multiple spaces in name to single dash", () => {
    const org = buildOrgDetails("user@protonmail.com", "Mary  Jane  Watson");
    expect(org.slug).toBe("mary-jane-watson-forge");
  });

  it("handles dotted corporate domains correctly", () => {
    const org = buildOrgDetails("user@my.company.co.uk", "User");
    expect(org.name).toBe("my.company.co.uk");
    expect(org.slug).toBe("my-company-co-uk");
  });

  it("throws on invalid email", () => {
    expect(() => buildOrgDetails("nodomain", "User")).toThrow("Invalid email");
  });
});

describe("sendInvitationEmail", () => {
  const originalEnv = process.env.WEB_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WEB_URL;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.WEB_URL = originalEnv;
    } else {
      delete process.env.WEB_URL;
    }
  });

  it("sends email with correct recipient, subject, and invite URL", async () => {
    const expiresAt = new Date("2025-12-31T12:00:00Z");
    const expectedDateStr = expiresAt.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    await sendInvitationEmail({
      invitation: { id: "inv-123", email: "alice@acme.com", expiresAt },
      organization: { name: "Acme Corp" },
      role: "admin",
    });

    expect(mockSendEmail).toHaveBeenCalledOnce();
    const call = mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe("alice@acme.com");
    expect(call.subject).toBe("You've been invited to join Acme Corp");
    expect(call.text).toContain("http://localhost:3000/invite/inv-123");
    expect(call.text).toContain("as a admin");
    expect(call.text).toContain(expectedDateStr);
    expect(call.html).toContain("http://localhost:3000/invite/inv-123");
  });

  it("defaults org name to 'an organization'", async () => {
    await sendInvitationEmail({
      invitation: { id: "inv-456", email: "bob@acme.com", expiresAt: new Date() },
      organization: {},
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.subject).toBe("You've been invited to join an organization");
    expect(call.text).toContain("join an organization");
  });

  it("defaults role to 'member'", async () => {
    await sendInvitationEmail({
      invitation: { id: "inv-789", email: "carol@acme.com", expiresAt: new Date() },
      organization: { name: "Test Org" },
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.text).toContain("as a member");
  });

  it("uses WEB_URL env var for invite link", async () => {
    process.env.WEB_URL = "https://app.clawforge.org";

    await sendInvitationEmail({
      invitation: { id: "inv-abc", email: "dave@acme.com", expiresAt: new Date() },
      organization: { name: "Test Org" },
      role: "member",
    });

    const call = mockSendEmail.mock.calls[0][0];
    expect(call.text).toContain("https://app.clawforge.org/invite/inv-abc");
    expect(call.html).toContain("https://app.clawforge.org/invite/inv-abc");
  });
});

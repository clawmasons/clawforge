import { describe, it, expect } from "vitest";
import {
  isPersonalEmail,
  buildOrgDetails,
  PERSONAL_DOMAINS,
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

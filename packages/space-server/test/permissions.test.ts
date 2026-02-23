import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parsePermission,
  buildPermissions,
  hasRight,
} from "../src/permissions.js";

// ---------------------------------------------------------------------------
// 6.1 parsePermission
// ---------------------------------------------------------------------------

describe("parsePermission", () => {
  it("parses a subspace:right string", () => {
    const p = parsePermission("prompts:write");
    assert.equal(p.subspace, "prompts");
    assert.equal(p.right, "write");
  });

  it("parses root permission (empty subspace)", () => {
    const p = parsePermission(":read");
    assert.equal(p.subspace, "");
    assert.equal(p.right, "read");
  });

  it("parses nested subspace", () => {
    const p = parsePermission("internal.chat:observe");
    assert.equal(p.subspace, "internal.chat");
    assert.equal(p.right, "observe");
  });

  it("parses all valid rights", () => {
    assert.equal(parsePermission("a:read").right, "read");
    assert.equal(parsePermission("a:observe").right, "observe");
    assert.equal(parsePermission("a:write").right, "write");
  });

  it("rejects string without colon", () => {
    assert.throws(() => parsePermission("foobar"), /missing colon/);
  });

  it("rejects invalid right", () => {
    assert.throws(() => parsePermission("prompts:admin"), /Invalid right/);
  });

  it("rejects empty right", () => {
    assert.throws(() => parsePermission("prompts:"), /Invalid right/);
  });
});

// ---------------------------------------------------------------------------
// 6.2 buildPermissions
// ---------------------------------------------------------------------------

describe("buildPermissions", () => {
  it("builds a permissions map from strings", () => {
    const perms = buildPermissions([":read", "prompts:write"]);
    assert.equal(perms.get(""), "read");
    assert.equal(perms.get("prompts"), "write");
  });

  it("highest right wins per subspace", () => {
    const perms = buildPermissions([
      "prompts:read",
      "prompts:observe",
      "prompts:write",
    ]);
    assert.equal(perms.get("prompts"), "write");
  });

  it("highest right wins regardless of order", () => {
    const perms = buildPermissions([
      "prompts:write",
      "prompts:read",
    ]);
    assert.equal(perms.get("prompts"), "write");
  });

  it("lower right does not downgrade higher", () => {
    const perms = buildPermissions([
      "prompts:write",
      "prompts:observe",
    ]);
    assert.equal(perms.get("prompts"), "write");
  });

  it("handles multiple subspaces independently", () => {
    const perms = buildPermissions([
      ":read",
      "prompts:write",
      "presence:observe",
      "internal.chat:read",
    ]);
    assert.equal(perms.get(""), "read");
    assert.equal(perms.get("prompts"), "write");
    assert.equal(perms.get("presence"), "observe");
    assert.equal(perms.get("internal.chat"), "read");
  });

  it("returns empty map for empty input", () => {
    const perms = buildPermissions([]);
    assert.equal(perms.size, 0);
  });
});

// ---------------------------------------------------------------------------
// 6.3 hasRight
// ---------------------------------------------------------------------------

describe("hasRight", () => {
  const perms = buildPermissions([
    ":read",
    "prompts:write",
    "presence:observe",
    "logs:read",
  ]);

  it("returns true for exact permission", () => {
    assert.equal(hasRight(perms, "", "read"), true);
    assert.equal(hasRight(perms, "prompts", "write"), true);
    assert.equal(hasRight(perms, "presence", "observe"), true);
    assert.equal(hasRight(perms, "logs", "read"), true);
  });

  it("write implies observe and read", () => {
    assert.equal(hasRight(perms, "prompts", "observe"), true);
    assert.equal(hasRight(perms, "prompts", "read"), true);
  });

  it("observe implies read", () => {
    assert.equal(hasRight(perms, "presence", "read"), true);
  });

  it("read does not imply observe or write", () => {
    assert.equal(hasRight(perms, "logs", "observe"), false);
    assert.equal(hasRight(perms, "logs", "write"), false);
  });

  it("observe does not imply write", () => {
    assert.equal(hasRight(perms, "presence", "write"), false);
  });

  it("returns false for missing subspace", () => {
    assert.equal(hasRight(perms, "unknown", "read"), false);
    assert.equal(hasRight(perms, "unknown", "write"), false);
  });

  it("root read does not imply observe or write", () => {
    assert.equal(hasRight(perms, "", "observe"), false);
    assert.equal(hasRight(perms, "", "write"), false);
  });
});

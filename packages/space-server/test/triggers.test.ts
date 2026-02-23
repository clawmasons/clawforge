import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { triggerPathMatches } from "../src/sync.js";

describe("triggerPathMatches", () => {
  it("matches memory-update prefixes", () => {
    assert.equal(triggerPathMatches("memory.section.item", "memory"), true);
    assert.equal(triggerPathMatches("memory.section.item", "memory.section"), true);
  });

  it("normalizes leading slashes in configured path", () => {
    assert.equal(triggerPathMatches("memory.section", "/memory"), true);
    assert.equal(triggerPathMatches("space/path/node", "/space/path"), true);
  });

  it("does not match unrelated paths", () => {
    assert.equal(triggerPathMatches("prompts.0.reply", "memory"), false);
    assert.equal(triggerPathMatches("presence.bot.status", "memory"), false);
  });
});

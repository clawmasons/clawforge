import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import * as Y from "yjs";
import { WebSocketServer, WebSocket } from "ws";
import { ClawforgeYjsClient } from "@clawforge/yjs-client";
import {
  setupYjsConnection,
  onWatch,
  type WatchEvent,
} from "../src/sync.js";

// ---------------------------------------------------------------------------
// Math-bot — observes prompts subspace, evaluates safe math, writes reply
// ---------------------------------------------------------------------------

const SAFE_MATH_RE = /^[\d+\-*/().%\s]+$/;

function startMathBot(client: ClawforgeYjsClient, botName: string): void {
  const promptsDoc = client.subspaces.get("prompts")!;
  const presenceDoc = client.subspaces.get("presence")!;
  const prompts: Y.Array<Y.Map<unknown>> = promptsDoc.getArray("prompts");
  const presence: Y.Map<Y.Map<string>> = presenceDoc.getMap("presence");

  // Register presence
  const inner = new Y.Map<string>();
  inner.set("type", "bot");
  inner.set("status", "waiting");
  presence.set(botName, inner);

  let baseLength = prompts.length;

  prompts.observe((event: Y.YArrayEvent<Y.Map<unknown>>) => {
    let index = 0;
    for (const delta of event.changes.delta) {
      if ("retain" in delta) {
        index += delta.retain!;
        continue;
      }
      if ("insert" in delta) {
        const items = delta.insert as Y.Map<unknown>[];
        for (const promptMap of items) {
          if (index < baseLength) {
            index++;
            continue;
          }

          const target = promptMap.get("target") as string | undefined;
          if (target !== "*" && target !== botName) {
            index++;
            continue;
          }

          const expr = promptMap.get("prompt") as string | undefined;
          if (!expr) {
            index++;
            continue;
          }

          // Set presence to thinking
          inner.set("status", "thinking");

          // Evaluate safely
          let answer: string;
          if (SAFE_MATH_RE.test(expr)) {
            try {
              answer = String(new Function(`return (${expr})`)());
            } catch {
              answer = "error";
            }
          } else {
            answer = "invalid";
          }

          // Write reply
          const replyArray = promptMap.get("reply-to-array") as
            | Y.Array<string>
            | undefined;
          if (replyArray) {
            replyArray.push([`${expr}=${answer}`]);
          }

          // Back to waiting
          inner.set("status", "waiting");

          index++;
        }
        continue;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Student helper — sends a prompt and returns the reply-to-array to observe
// ---------------------------------------------------------------------------

function sendPrompt(
  promptsDoc: Y.Doc,
  text: string,
  target: string,
): { replyArray: Y.Array<string> } {
  const prompts: Y.Array<Y.Map<unknown>> = promptsDoc.getArray("prompts");
  const replyArray = new Y.Array<string>();
  const replyStream = new Y.Text();

  const promptMap = new Y.Map<unknown>();
  promptsDoc.transact(() => {
    promptMap.set("prompt", text);
    promptMap.set("target", target);
    promptMap.set("reply-to-array", replyArray);
    promptMap.set("reply-to-stream", replyStream);
    prompts.push([promptMap]);
  });

  return { replyArray };
}

// ---------------------------------------------------------------------------
// waitForReply — resolves when reply-to-array gets an item
// ---------------------------------------------------------------------------

function waitForReply(
  replyArray: Y.Array<string>,
  timeoutMs = 5_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Already has a reply?
    if (replyArray.length > 0) {
      resolve(replyArray.get(0));
      return;
    }

    const timer = setTimeout(() => {
      replyArray.unobserve(observer);
      reject(new Error("Timed out waiting for reply"));
    }, timeoutMs);

    const observer = () => {
      if (replyArray.length > 0) {
        clearTimeout(timer);
        replyArray.unobserve(observer);
        resolve(replyArray.get(0));
      }
    };

    replyArray.observe(observer);
  });
}

// Explicit permissions for both bot and student:
// - prompts:write — read/write prompts and replies
// - presence:write — register and update presence
const FULL_ACCESS = [":read", "prompts:write", "presence:write"];

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("math-bot integration", () => {
  let httpServer: HttpServer;
  let wss: WebSocketServer;
  let serverDoc: Y.Doc;
  let botClient: ClawforgeYjsClient;
  let studentClient: ClawforgeYjsClient;
  let port: number;
  let watchEvents: WatchEvent[];
  let unsubWatch: () => void;

  before(async () => {
    // 0. Collect watch events
    watchEvents = [];
    unsubWatch = onWatch((e) => watchEvents.push(e));

    // 1. Start server
    serverDoc = new Y.Doc();
    httpServer = createServer();
    wss = new WebSocketServer({ server: httpServer });

    wss.on("connection", (ws) => {
      setupYjsConnection(ws, serverDoc, FULL_ACCESS);
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });

    const addr = httpServer.address();
    port = typeof addr === "object" && addr !== null ? addr.port : 0;

    // 2. Connect bot, wait for root sync, then request subspaces
    botClient = new ClawforgeYjsClient({
      url: `ws://127.0.0.1:${port}`,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    });
    await botClient.synced;
    botClient.subspace("prompts");
    botClient.subspace("presence");
    await new Promise((r) => setTimeout(r, 100));

    // 3. Register bot observer + presence
    startMathBot(botClient, "math-bot");

    // 4. Connect student, wait for root sync, then request subspaces
    studentClient = new ClawforgeYjsClient({
      url: `ws://127.0.0.1:${port}`,
      WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
    });
    await studentClient.synced;
    studentClient.subspace("prompts");
    studentClient.subspace("presence");
    await new Promise((r) => setTimeout(r, 100));

    // 5. Register student presence
    const presenceDoc = studentClient.subspaces.get("presence")!;
    const presence: Y.Map<Y.Map<string>> = presenceDoc.getMap("presence");
    const inner = new Y.Map<string>();
    inner.set("type", "user");
    inner.set("status", "waiting");
    presence.set("student", inner);

    // Give a moment for presence to propagate
    await new Promise((r) => setTimeout(r, 100));
  });

  after(async () => {
    unsubWatch();
    botClient.close();
    studentClient.close();

    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    serverDoc.destroy();
  });

  it("evaluates 2+2", async () => {
    const promptsDoc = studentClient.subspaces.get("prompts")!;
    const { replyArray } = sendPrompt(promptsDoc, "2+2", "math-bot");
    const reply = await waitForReply(replyArray);
    assert.equal(reply, "2+2=4");
  });

  it("evaluates 10*5", async () => {
    const promptsDoc = studentClient.subspaces.get("prompts")!;
    const { replyArray } = sendPrompt(promptsDoc, "10*5", "math-bot");
    const reply = await waitForReply(replyArray);
    assert.equal(reply, "10*5=50");
  });

  it("evaluates 100/4", async () => {
    const promptsDoc = studentClient.subspaces.get("prompts")!;
    const { replyArray } = sendPrompt(promptsDoc, "100/4", "math-bot");
    const reply = await waitForReply(replyArray);
    assert.equal(reply, "100/4=25");
  });

  it("evaluates 7-3", async () => {
    const promptsDoc = studentClient.subspaces.get("prompts")!;
    const { replyArray } = sendPrompt(promptsDoc, "7-3", "math-bot");
    const reply = await waitForReply(replyArray);
    assert.equal(reply, "7-3=4");
  });

  it("bot presence is visible to student", () => {
    const presenceDoc = studentClient.subspaces.get("presence")!;
    const presence: Y.Map<Y.Map<string>> = presenceDoc.getMap("presence");
    const bot = presence.get("math-bot");
    assert.ok(bot, "math-bot presence should exist");
    assert.equal(bot.get("type"), "bot");
    assert.equal(bot.get("status"), "waiting");
  });

  it("student presence is visible to bot", () => {
    const presenceDoc = botClient.subspaces.get("presence")!;
    const presence: Y.Map<Y.Map<string>> = presenceDoc.getMap("presence");
    const student = presence.get("student");
    assert.ok(student, "student presence should exist");
    assert.equal(student.get("type"), "user");
    assert.equal(student.get("status"), "waiting");
  });

  it("watcher fires 'New prompt added' on prompt insert", async () => {
    const before = watchEvents.length;
    const promptsDoc = studentClient.subspaces.get("prompts")!;
    const { replyArray } = sendPrompt(promptsDoc, "1+1", "math-bot");
    await waitForReply(replyArray);

    const newEvents = watchEvents.slice(before);
    const match = newEvents.find((e) => e.message === "New prompt added");
    assert.ok(match, "expected a 'New prompt added' watch event");
    assert.match(match.path, /^prompts\[\d+\]$/);
  });

  it("watcher fires 'Reply received' on reply-to-array insert", async () => {
    const before = watchEvents.length;
    const promptsDoc = studentClient.subspaces.get("prompts")!;
    const { replyArray } = sendPrompt(promptsDoc, "3+3", "math-bot");
    await waitForReply(replyArray);
    // Allow server observer to process the reply sync
    await new Promise((r) => setTimeout(r, 100));

    const newEvents = watchEvents.slice(before);
    const match = newEvents.find((e) => e.message === "Reply received");
    assert.ok(match, "expected a 'Reply received' watch event");
    assert.ok(match.value.includes("3+3=6"), `expected value to contain '3+3=6', got '${match.value}'`);
  });

  it("watcher fires 'Status changed' on presence status update", async () => {
    const before = watchEvents.length;
    const promptsDoc = studentClient.subspaces.get("prompts")!;
    const { replyArray } = sendPrompt(promptsDoc, "5+5", "math-bot");
    await waitForReply(replyArray);

    const newEvents = watchEvents.slice(before);
    const match = newEvents.find((e) => e.message === "Status changed");
    assert.ok(match, "expected a 'Status changed' watch event");
    assert.equal(match.pattern, "presence.*.status");
  });

  it("watcher fires 'Presence updated' on new presence entry", () => {
    const match = watchEvents.find((e) => e.message === "Presence updated");
    assert.ok(match, "expected a 'Presence updated' watch event");
  });
});

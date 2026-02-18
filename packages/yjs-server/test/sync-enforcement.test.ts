import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import * as Y from "yjs";
import { WebSocketServer, WebSocket } from "ws";
import { ClawforgeYjsClient, type PermissionError } from "@clawforge/yjs-client";
import { setupYjsConnection } from "../src/sync.js";

/** Create a ClawforgeYjsClient connected to the test server. */
function createClient(port: number): ClawforgeYjsClient {
  return new ClawforgeYjsClient({
    url: `ws://127.0.0.1:${port}`,
    WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
  });
}

/** Collect permission errors from a client into an array. */
function collectPermissionErrors(client: ClawforgeYjsClient): PermissionError[] {
  const errors: PermissionError[] = [];
  client.on("permissionError", (err) => errors.push(err));
  return errors;
}

/** Wait for a condition with timeout */
function waitFor(
  check: () => boolean,
  timeoutMs = 3000,
  intervalMs = 20,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (check()) { resolve(); return; }
    const timer = setTimeout(() => {
      clearInterval(interval);
      reject(new Error("Timed out waiting for condition"));
    }, timeoutMs);
    const interval = setInterval(() => {
      if (check()) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve();
      }
    }, intervalMs);
  });
}

// ---------------------------------------------------------------------------
// 7.1 Write enforcement
// ---------------------------------------------------------------------------

describe("write enforcement", () => {
  let httpServer: HttpServer;
  let wss: WebSocketServer;
  let serverDoc: Y.Doc;
  let port: number;

  before(async () => {
    serverDoc = new Y.Doc();
    httpServer = createServer();
    wss = new WebSocketServer({ server: httpServer });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    const addr = httpServer.address();
    port = typeof addr === "object" && addr !== null ? addr.port : 0;
  });

  after(async () => {
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    serverDoc.destroy();
  });

  it("rejects write from connection with prompts:read", async () => {
    wss.removeAllListeners("connection");
    wss.on("connection", (ws) => {
      setupYjsConnection(ws, serverDoc, [":read", "prompts:read"]);
    });

    const client = createClient(port);
    const permissionErrors = collectPermissionErrors(client);
    await client.synced;

    // Client-initiated subspace sync
    client.subspace("prompts");
    await new Promise((r) => setTimeout(r, 100));

    // Try to write to prompts subspace — the auto-forwarder in subspace()
    // sends the update as MSG_SUBSPACE_SYNC with messageYjsUpdate, which the
    // server rejects for read-only connections.
    const subdoc = client.subspaces.get("prompts")!;
    const arr = subdoc.getArray("prompts");
    const map = new Y.Map();
    map.set("prompt", "hello");
    arr.push([map]);

    // Wait for permission error
    await waitFor(() => permissionErrors.length > 0);
    assert.equal(permissionErrors[0].error, "permission_denied");
    assert.deepEqual(permissionErrors[0].subspaces, ["prompts"]);

    client.close();
  });

  it("allows write from connection with prompts:write", async () => {
    wss.removeAllListeners("connection");
    wss.on("connection", (ws) => {
      setupYjsConnection(ws, serverDoc, [":read", "prompts:write"]);
    });

    const client = createClient(port);
    const permissionErrors = collectPermissionErrors(client);
    await client.synced;

    // Client-initiated subspace sync (auto-forwards updates)
    client.subspace("prompts");
    await new Promise((r) => setTimeout(r, 100));

    // Write to prompts subspace
    const subdoc = client.subspaces.get("prompts")!;
    const arr = subdoc.getArray("data");
    arr.push(["test-value"]);

    // Wait for sync
    await new Promise((r) => setTimeout(r, 200));

    // No permission errors
    assert.equal(permissionErrors.length, 0);

    client.close();
  });
});

// ---------------------------------------------------------------------------
// 7.2 Observe enforcement
// ---------------------------------------------------------------------------

describe("observe enforcement", () => {
  let httpServer: HttpServer;
  let wss: WebSocketServer;
  let serverDoc: Y.Doc;
  let port: number;

  before(async () => {
    serverDoc = new Y.Doc();
    httpServer = createServer();
    wss = new WebSocketServer({ server: httpServer });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    const addr = httpServer.address();
    port = typeof addr === "object" && addr !== null ? addr.port : 0;
  });

  after(async () => {
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    serverDoc.destroy();
  });

  it("connection with prompts:observe receives live updates", async () => {
    let connectionIndex = 0;
    wss.removeAllListeners("connection");
    wss.on("connection", (ws) => {
      if (connectionIndex === 0) {
        setupYjsConnection(ws, serverDoc, [":read", "prompts:write"]);
      } else {
        setupYjsConnection(ws, serverDoc, [":read", "prompts:observe"]);
      }
      connectionIndex++;
    });

    const writer = createClient(port);
    await writer.synced;
    writer.subspace("prompts");
    await new Promise((r) => setTimeout(r, 100));

    const observer = createClient(port);
    await observer.synced;
    observer.subspace("prompts");
    await new Promise((r) => setTimeout(r, 100));

    // Writer writes data
    const writerSubdoc = writer.subspaces.get("prompts")!;
    const arr = writerSubdoc.getArray("items");
    arr.push(["live-update-test"]);

    // Observer should receive the update
    await waitFor(() => {
      const observerSubdoc = observer.subspaces.get("prompts");
      if (!observerSubdoc) return false;
      const observerArr = observerSubdoc.getArray("items");
      return observerArr.length > 0 && observerArr.get(0) === "live-update-test";
    });

    const observerSubdoc = observer.subspaces.get("prompts")!;
    const observerArr = observerSubdoc.getArray("items");
    assert.equal(observerArr.get(0), "live-update-test");

    writer.close();
    observer.close();
  });

  it("connection with prompts:read does NOT receive live updates", async () => {
    const freshDoc = new Y.Doc();

    let connectionIndex = 0;
    wss.removeAllListeners("connection");
    wss.on("connection", (ws) => {
      if (connectionIndex === 0) {
        setupYjsConnection(ws, freshDoc, [":read", "prompts:write"]);
      } else {
        setupYjsConnection(ws, freshDoc, [":read", "prompts:read"]);
      }
      connectionIndex++;
    });

    const writer = createClient(port);
    await writer.synced;
    writer.subspace("prompts");
    await new Promise((r) => setTimeout(r, 100));

    const reader = createClient(port);
    await reader.synced;
    reader.subspace("prompts");
    await new Promise((r) => setTimeout(r, 100));

    // Writer writes data AFTER reader has synced
    const writerSubdoc = writer.subspaces.get("prompts")!;
    const arr = writerSubdoc.getArray("items");
    arr.push(["should-not-reach-reader"]);

    // Wait a bit to see if reader gets it
    await new Promise((r) => setTimeout(r, 300));

    // Reader should NOT have received the update
    const readerSubdoc = reader.subspaces.get("prompts");
    if (readerSubdoc) {
      const readerArr = readerSubdoc.getArray("items");
      assert.equal(readerArr.length, 0, "read-only client should not receive live updates");
    }

    writer.close();
    reader.close();
    freshDoc.destroy();
  });
});

// ---------------------------------------------------------------------------
// 7.3 Read enforcement
// ---------------------------------------------------------------------------

describe("read enforcement", () => {
  let httpServer: HttpServer;
  let wss: WebSocketServer;
  let serverDoc: Y.Doc;
  let port: number;

  before(async () => {
    serverDoc = new Y.Doc();
    httpServer = createServer();
    wss = new WebSocketServer({ server: httpServer });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    const addr = httpServer.address();
    port = typeof addr === "object" && addr !== null ? addr.port : 0;
  });

  after(async () => {
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    serverDoc.destroy();
  });

  it("syncing an authorized subspace succeeds; unauthorized subspace gets permission error", async () => {
    wss.removeAllListeners("connection");
    wss.on("connection", (ws) => {
      // This connection has prompts:read but NOT presence
      setupYjsConnection(ws, serverDoc, [":read", "prompts:read"]);
    });

    const client = createClient(port);
    const permissionErrors = collectPermissionErrors(client);
    await client.synced;

    // Request prompts (authorized) — should sync without error
    client.subspace("prompts");
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(client.subspaces.has("prompts"), "should have prompts subspace");
    assert.equal(permissionErrors.length, 0);

    // Request presence (unauthorized) — should get permission error
    client.subspace("presence");
    await waitFor(() => permissionErrors.length > 0);
    assert.equal(permissionErrors[0].error, "permission_denied");
    assert.deepEqual(permissionErrors[0].subspaces, ["presence"]);

    client.close();
  });
});

// ---------------------------------------------------------------------------
// 7.4 Stub auth default
// ---------------------------------------------------------------------------

describe("stub auth default", () => {
  let httpServer: HttpServer;
  let wss: WebSocketServer;
  let serverDoc: Y.Doc;
  let port: number;

  before(async () => {
    serverDoc = new Y.Doc();
    httpServer = createServer();
    wss = new WebSocketServer({ server: httpServer });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    const addr = httpServer.address();
    port = typeof addr === "object" && addr !== null ? addr.port : 0;
  });

  after(async () => {
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    serverDoc.destroy();
  });

  it("connection without explicit permissions gets only :read (root read-only, no subspace access)", async () => {
    wss.removeAllListeners("connection");
    wss.on("connection", (ws) => {
      // No explicit permissions — defaults to [":read"]
      setupYjsConnection(ws, serverDoc);
    });

    const client = createClient(port);
    const permissionErrors = collectPermissionErrors(client);
    await client.synced;

    // Try to write to root doc — should be rejected
    const rootMap = client.doc.getMap("test");
    rootMap.set("key", "value");

    // Wait for permission error
    await waitFor(() => permissionErrors.length > 0);
    assert.equal(permissionErrors[0].error, "permission_denied");

    // Try to sync a subspace — should also be rejected
    client.subspace("prompts");
    await waitFor(() => permissionErrors.length > 1);
    assert.equal(permissionErrors[1].error, "permission_denied");
    assert.deepEqual(permissionErrors[1].subspaces, ["prompts"]);

    client.close();
  });
});

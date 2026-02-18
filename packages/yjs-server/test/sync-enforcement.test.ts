import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server as HttpServer } from "node:http";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { WebSocketServer, WebSocket } from "ws";
import {
  setupYjsConnection,
  MSG_SYNC,
  MSG_SUBSPACE_SYNC,
  MSG_PERMISSION_ERROR,
} from "../src/sync.js";

// ---------------------------------------------------------------------------
// Subspace-aware test client
// ---------------------------------------------------------------------------

interface TestClient {
  doc: Y.Doc;
  subspaces: Map<string, Y.Doc>;
  ws: WebSocket;
  synced: Promise<void>;
  permissionErrors: Array<{ error: string; subspaces: string[] }>;
  close: () => void;
  /** Request sync for a subspace. Creates local doc, sends step1, auto-forwards updates. */
  syncSubspace: (name: string) => Y.Doc;
}

function createTestClient(port: number): TestClient {
  const doc = new Y.Doc();
  const subspaces = new Map<string, Y.Doc>();
  const permissionErrors: Array<{ error: string; subspaces: string[] }> = [];
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  ws.binaryType = "arraybuffer";

  let resolveSynced: () => void;
  const synced = new Promise<void>((resolve) => {
    resolveSynced = resolve;
  });

  let rootSynced = false;

  ws.on("open", () => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc);
    ws.send(encoding.toUint8Array(encoder));
  });

  ws.on("message", (data: ArrayBuffer | Buffer) => {
    const message = new Uint8Array(data as ArrayBuffer);
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MSG_SYNC: {
        const responseEncoder = encoding.createEncoder();
        encoding.writeVarUint(responseEncoder, MSG_SYNC);
        const syncType = syncProtocol.readSyncMessage(
          decoder,
          responseEncoder,
          doc,
          "remote",
        );
        if (syncType === 1 && !rootSynced) {
          rootSynced = true;
          resolveSynced();
        }
        if (encoding.length(responseEncoder) > 1) {
          ws.send(encoding.toUint8Array(responseEncoder));
        }
        break;
      }
      case MSG_SUBSPACE_SYNC: {
        const subspaceName = decoding.readVarString(decoder);
        let subdoc = subspaces.get(subspaceName);
        if (!subdoc) {
          subdoc = new Y.Doc();
          subspaces.set(subspaceName, subdoc);
        }
        const responseEncoder = encoding.createEncoder();
        encoding.writeVarUint(responseEncoder, MSG_SUBSPACE_SYNC);
        encoding.writeVarString(responseEncoder, subspaceName);
        const beforeLen = encoding.length(responseEncoder);
        syncProtocol.readSyncMessage(decoder, responseEncoder, subdoc, "remote");
        if (encoding.length(responseEncoder) > beforeLen) {
          ws.send(encoding.toUint8Array(responseEncoder));
        }
        break;
      }
      case MSG_PERMISSION_ERROR: {
        const payload = decoding.readVarString(decoder);
        permissionErrors.push(JSON.parse(payload));
        break;
      }
    }
  });

  // Forward local root doc updates to server
  const onRootUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === "remote") return;
    if (ws.readyState !== WebSocket.OPEN) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    ws.send(encoding.toUint8Array(encoder));
  };
  doc.on("update", onRootUpdate);

  const syncSubspace = (name: string): Y.Doc => {
    let subdoc = subspaces.get(name);
    if (subdoc) return subdoc;
    subdoc = new Y.Doc();
    subspaces.set(name, subdoc);
    subdoc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return;
      if (ws.readyState !== WebSocket.OPEN) return;
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_SUBSPACE_SYNC);
      encoding.writeVarString(enc, name);
      syncProtocol.writeUpdate(enc, update);
      ws.send(encoding.toUint8Array(enc));
    });
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_SUBSPACE_SYNC);
    encoding.writeVarString(enc, name);
    syncProtocol.writeSyncStep1(enc, subdoc);
    ws.send(encoding.toUint8Array(enc));
    return subdoc;
  };

  const close = () => {
    doc.off("update", onRootUpdate);
    for (const subdoc of subspaces.values()) {
      subdoc.destroy();
    }
    ws.close();
  };

  return { doc, subspaces, ws, synced, permissionErrors, close, syncSubspace };
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

    const client = createTestClient(port);
    await client.synced;

    // Client-initiated subspace sync
    client.syncSubspace("prompts");
    await new Promise((r) => setTimeout(r, 100));

    // Try to write to prompts subspace — the auto-forwarder in syncSubspace
    // sends the update as MSG_SUBSPACE_SYNC with messageYjsUpdate, which the
    // server rejects for read-only connections.
    const subdoc = client.subspaces.get("prompts")!;
    const arr = subdoc.getArray("prompts");
    const map = new Y.Map();
    map.set("prompt", "hello");
    arr.push([map]);

    // Wait for permission error
    await waitFor(() => client.permissionErrors.length > 0);
    assert.equal(client.permissionErrors[0].error, "permission_denied");
    assert.deepEqual(client.permissionErrors[0].subspaces, ["prompts"]);

    client.close();
  });

  it("allows write from connection with prompts:write", async () => {
    wss.removeAllListeners("connection");
    wss.on("connection", (ws) => {
      setupYjsConnection(ws, serverDoc, [":read", "prompts:write"]);
    });

    const client = createTestClient(port);
    await client.synced;

    // Client-initiated subspace sync (auto-forwards updates)
    client.syncSubspace("prompts");
    await new Promise((r) => setTimeout(r, 100));

    // Write to prompts subspace
    const subdoc = client.subspaces.get("prompts")!;
    const arr = subdoc.getArray("data");
    arr.push(["test-value"]);

    // Wait for sync
    await new Promise((r) => setTimeout(r, 200));

    // No permission errors
    assert.equal(client.permissionErrors.length, 0);

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

    const writer = createTestClient(port);
    await writer.synced;
    writer.syncSubspace("prompts");
    await new Promise((r) => setTimeout(r, 100));

    const observer = createTestClient(port);
    await observer.synced;
    observer.syncSubspace("prompts");
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

    const writer = createTestClient(port);
    await writer.synced;
    writer.syncSubspace("prompts");
    await new Promise((r) => setTimeout(r, 100));

    const reader = createTestClient(port);
    await reader.synced;
    reader.syncSubspace("prompts");
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

    const client = createTestClient(port);
    await client.synced;

    // Request prompts (authorized) — should sync without error
    client.syncSubspace("prompts");
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(client.subspaces.has("prompts"), "should have prompts subspace");
    assert.equal(client.permissionErrors.length, 0);

    // Request presence (unauthorized) — should get permission error
    client.syncSubspace("presence");
    await waitFor(() => client.permissionErrors.length > 0);
    assert.equal(client.permissionErrors[0].error, "permission_denied");
    assert.deepEqual(client.permissionErrors[0].subspaces, ["presence"]);

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

    const client = createTestClient(port);
    await client.synced;

    // Try to write to root doc — should be rejected
    const rootMap = client.doc.getMap("test");
    rootMap.set("key", "value");

    // Wait for permission error
    await waitFor(() => client.permissionErrors.length > 0);
    assert.equal(client.permissionErrors[0].error, "permission_denied");

    // Try to sync a subspace — should also be rejected
    client.syncSubspace("prompts");
    await waitFor(() => client.permissionErrors.length > 1);
    assert.equal(client.permissionErrors[1].error, "permission_denied");
    assert.deepEqual(client.permissionErrors[1].subspaces, ["prompts"]);

    client.close();
  });
});

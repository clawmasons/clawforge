import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import type { WebSocket } from "ws";
import {
  type ConnectionPermissions,
  buildPermissions,
  hasRight,
} from "./permissions.js";

export const MSG_SYNC = 0;
export const MSG_AWARENESS = 1;
export const MSG_SUBSPACE_SYNC = 2;
export const MSG_PERMISSION_ERROR = 3;

// ---------------------------------------------------------------------------
// Per-doc state — scoped via WeakMap so tests with separate docs don't collide
// ---------------------------------------------------------------------------

interface ConnectionState {
  permissions: ConnectionPermissions;
  syncedSubspaces: Set<string>;
}

interface DocState {
  connections: Map<WebSocket, ConnectionState>;
  subspaces: Map<string, Y.Doc>;
  rootHandlerRegistered: boolean;
}

const docStates = new WeakMap<Y.Doc, DocState>();
const observedRootsByDoc = new WeakMap<Y.Doc, Set<string>>();

function getObservedRoots(doc: Y.Doc): Set<string> {
  let set = observedRootsByDoc.get(doc);
  if (!set) {
    set = new Set();
    observedRootsByDoc.set(doc, set);
  }
  return set;
}

function getDocState(doc: Y.Doc): DocState {
  let state = docStates.get(doc);
  if (!state) {
    state = {
      connections: new Map(),
      subspaces: new Map(),
      rootHandlerRegistered: false,
    };
    docStates.set(doc, state);
  }
  return state;
}

function getOrCreateSubspaceDoc(
  docState: DocState,
  subspace: string,
): Y.Doc {
  let subdoc = docState.subspaces.get(subspace);
  if (!subdoc) {
    subdoc = new Y.Doc();
    docState.subspaces.set(subspace, subdoc);
    registerSubspaceUpdateHandler(docState, subspace, subdoc);
  }
  return subdoc;
}

// ---------------------------------------------------------------------------
// Update broadcast handlers (registered once per doc / subspace)
// ---------------------------------------------------------------------------

function registerRootUpdateHandler(docState: DocState, doc: Y.Doc): void {
  if (docState.rootHandlerRegistered) return;
  docState.rootHandlerRegistered = true;

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const [conn, state] of docState.connections) {
      if (conn === origin) continue;
      if (
        conn.readyState === 1 /* OPEN */ &&
        hasRight(state.permissions, "", "observe")
      ) {
        conn.send(message);
      }
    }
  });
}

function registerSubspaceUpdateHandler(
  docState: DocState,
  subspace: string,
  subdoc: Y.Doc,
): void {
  subdoc.on("update", (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SUBSPACE_SYNC);
    encoding.writeVarString(encoder, subspace);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const [conn, state] of docState.connections) {
      if (conn === origin) continue;
      if (
        conn.readyState === 1 /* OPEN */ &&
        state.syncedSubspaces.has(subspace) &&
        hasRight(state.permissions, subspace, "observe")
      ) {
        conn.send(message);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Permission error frame
// ---------------------------------------------------------------------------

function sendPermissionError(ws: WebSocket, subspaces: string[]): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_PERMISSION_ERROR);
  const payload = JSON.stringify({ error: "permission_denied", subspaces });
  encoding.writeVarString(encoder, payload);
  ws.send(encoding.toUint8Array(encoder));
}

// ---------------------------------------------------------------------------
// Glob-pattern watchers for observeDeep changes
// ---------------------------------------------------------------------------

interface PathWatcher {
  pattern: string;
  message: string;
  regex: RegExp;
}

/** Convert a dot/bracket path pattern to a RegExp.
 *  - `**` → match any number of segments (greedy)
 *  - `*`  → match exactly one segment (chars between `.` `[` `]`)
 *  - Literal `.` and `[]` are escaped
 */
function patternToRegex(pattern: string): RegExp {
  // Split on wildcard tokens, escape the literal parts, then rejoin
  const parts = pattern.split(/(\*\*|\*)/);
  const src = parts
    .map((part) => {
      if (part === "**") return ".*";
      if (part === "*") return "[^.\\[\\]]+";
      // Escape regex-special chars in literal segments
      return part.replace(/([.[\]\\^$+?{}()|])/g, "\\$&");
    })
    .join("");
  return new RegExp(`^${src}$`);
}

function compileWatchers(
  defs: { pattern: string; message: string }[],
): PathWatcher[] {
  return defs.map((d) => ({
    ...d,
    regex: patternToRegex(d.pattern),
  }));
}

const watchers: PathWatcher[] = compileWatchers([
  { pattern: "prompts[*]", message: "New prompt added" },
  { pattern: "prompts[*].reply-to-array", message: "Reply received" },
  { pattern: "presence.*.status", message: "Status changed" },
  { pattern: "presence.*", message: "Presence updated" },
]);

// ---------------------------------------------------------------------------
// Watch-event hook system
// ---------------------------------------------------------------------------

export interface WatchEvent {
  path: string;
  pattern: string;
  message: string;
  action: string;
  value: string;
}

export type WatchHook = (event: WatchEvent) => void;

const watchHooks = new Set<WatchHook>();

export function onWatch(hook: WatchHook): () => void {
  watchHooks.add(hook);
  return () => { watchHooks.delete(hook); };
}

// Default: log to console (same output as before)
onWatch((e) => {
  console.log(`[watch] ${e.path} — ${e.message} (${e.action} ${e.value})`);
});

// ---------------------------------------------------------------------------
// observeDeep logger — auto-attaches to root types as they appear
// ---------------------------------------------------------------------------

function formatValue(v: unknown): string {
  if (v instanceof Y.AbstractType) return `[${v.constructor.name}]`;
  return JSON.stringify(v);
}

function logWatchMatches(fullPath: string, action: string, value: string): void {
  for (const w of watchers) {
    if (w.regex.test(fullPath)) {
      const event: WatchEvent = {
        path: fullPath,
        pattern: w.pattern,
        message: w.message,
        action,
        value,
      };
      for (const hook of watchHooks) {
        hook(event);
      }
    }
  }
}

/** Resolve a typed shared type from the doc.
 *  Types created via remote sync start as AbstractType;
 *  observeDeep only fires on the properly typed version. */
function getTypedRoot(doc: Y.Doc, name: string, raw: Y.AbstractType<unknown>): Y.AbstractType<unknown> {
  if (raw instanceof Y.Map || raw instanceof Y.Array || raw instanceof Y.Text) {
    return raw;
  }
  // Infer the correct type from watcher patterns:
  //   "name[…" → Array, "name.…" or bare "name" → Map
  const isArray = watchers.some(
    (w) => w.pattern.startsWith(`${name}[`),
  );
  return isArray ? doc.getArray(name) : doc.getMap(name);
}

function ensureDeepObservers(doc: Y.Doc, observedRoots: Set<string>): void {
  for (const [name, raw] of doc.share.entries()) {
    if (observedRoots.has(name)) continue;
    observedRoots.add(name);

    const type = getTypedRoot(doc, name, raw);
    type.observeDeep((events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
      for (const event of events) {
        const path = event.path;
        const pathStr = path.length === 0
          ? name
          : name + path.map(p => typeof p === "number" ? `[${p}]` : `.${p}`).join("");

        // Array changes (delta)
        if (event.changes.delta && event.changes.delta.length > 0) {
          let idx = 0;
          for (const d of event.changes.delta) {
            if (d.retain) {
              idx += d.retain;
            }
            if (d.insert) {
              const items = Array.isArray(d.insert) ? d.insert : [d.insert];
              for (const item of items) {
                const itemPath = `${pathStr}[${idx}]`;
                const val = item instanceof Y.Map
                  ? "Y.Map " + JSON.stringify(
                      Object.fromEntries(
                        [...item.entries()].map(([k, v]) => [k, formatValue(v)]),
                      ),
                    )
                  : formatValue(item);
                // Fire for both container path and indexed item path
                logWatchMatches(pathStr, "insert", val);
                logWatchMatches(itemPath, "insert", val);
                idx++;
              }
            }
            if (d.delete) {
              logWatchMatches(pathStr, "delete", `${d.delete} items`);
            }
          }
        }

        // Map changes (keys)
        if (event.changes.keys && event.changes.keys.size > 0) {
          for (const [key, { action }] of event.changes.keys) {
            const newVal = (event.target as Y.Map<unknown>).get(key);
            logWatchMatches(`${pathStr}.${key}`, action, `-> ${formatValue(newVal)}`);
          }
        }
      }
    });

    console.log(`[observe] Watching root type: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Sync message handling (decomposed for permission checks)
// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function setupYjsConnection(
  ws: WebSocket,
  doc: Y.Doc,
  permissionStrings?: string[],
): void {
  const docState = getDocState(doc);
  const perms = buildPermissions(permissionStrings ?? [":read"]);
  const connState: ConnectionState = { permissions: perms, syncedSubspaces: new Set() };
  docState.connections.set(ws, connState);

  // Register root update handler (once per doc)
  registerRootUpdateHandler(docState, doc);

  // Send root doc sync step 1
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, doc);
    ws.send(encoding.toUint8Array(encoder));
  }

  // Subspaces are lazy-loaded: the client sends MSG_SUBSPACE_SYNC step1
  // for each subspace it wants. The server checks permissions and responds
  // with step2 (the actual data). No eager sync on connect.

  // Listen for incoming messages
  ws.on("message", (data: ArrayBuffer | Buffer) => {
    const message = new Uint8Array(data as ArrayBuffer);
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MSG_SYNC: {
        // Root document sync
        const responseEncoder = encoding.createEncoder();
        encoding.writeVarUint(responseEncoder, MSG_SYNC);
        const beforeLen = encoding.length(responseEncoder);

        // Read inner sync message type for write enforcement
        const syncType = decoding.readVarUint(decoder);

        // Only enforce write on intentional updates (type 2).
        // syncStep1 (type 0) is a read request; syncStep2 (type 1) completes
        // the handshake and is typically empty for read-only clients.
        if (
          syncType === syncProtocol.messageYjsUpdate &&
          !hasRight(perms, "", "write")
        ) {
          sendPermissionError(ws, [""]);
          break;
        }

        // Process the sync message (type already consumed, handle directly)
        switch (syncType) {
          case syncProtocol.messageYjsSyncStep1:
            syncProtocol.readSyncStep1(decoder, responseEncoder, doc);
            break;
          case syncProtocol.messageYjsSyncStep2:
            syncProtocol.readSyncStep2(decoder, doc, ws);
            break;
          case syncProtocol.messageYjsUpdate:
            syncProtocol.readUpdate(decoder, doc, ws);
            break;
        }

        // Attach deep observers to any newly created root types
        ensureDeepObservers(doc, getObservedRoots(doc));

        if (encoding.length(responseEncoder) > beforeLen) {
          ws.send(encoding.toUint8Array(responseEncoder));
        }
        break;
      }

      case MSG_SUBSPACE_SYNC: {
        const subspaceName = decoding.readVarString(decoder);

        // Must have at least read permission on the subspace
        if (!hasRight(perms, subspaceName, "read")) {
          sendPermissionError(ws, [subspaceName]);
          break;
        }

        const subdoc = getOrCreateSubspaceDoc(docState, subspaceName);
        const responseEncoder = encoding.createEncoder();
        encoding.writeVarUint(responseEncoder, MSG_SUBSPACE_SYNC);
        encoding.writeVarString(responseEncoder, subspaceName);
        const beforeLen = encoding.length(responseEncoder);

        // Read inner sync message type for write enforcement
        const syncType = decoding.readVarUint(decoder);

        // Only enforce write on intentional updates (type 2)
        if (
          syncType === syncProtocol.messageYjsUpdate &&
          !hasRight(perms, subspaceName, "write")
        ) {
          sendPermissionError(ws, [subspaceName]);
          break;
        }

        switch (syncType) {
          case syncProtocol.messageYjsSyncStep1:
            // Client is requesting this subspace — mark as synced so it
            // receives future update broadcasts
            connState.syncedSubspaces.add(subspaceName);
            syncProtocol.readSyncStep1(decoder, responseEncoder, subdoc);
            break;
          case syncProtocol.messageYjsSyncStep2:
            syncProtocol.readSyncStep2(decoder, subdoc, ws);
            break;
          case syncProtocol.messageYjsUpdate:
            syncProtocol.readUpdate(decoder, subdoc, ws);
            break;
        }

        // Attach deep observers to subspace types
        ensureDeepObservers(subdoc, getObservedRoots(subdoc));

        if (encoding.length(responseEncoder) > beforeLen) {
          ws.send(encoding.toUint8Array(responseEncoder));
        }
        break;
      }

      case MSG_AWARENESS: {
        // Relay raw awareness data to all other clients
        for (const [conn] of docState.connections) {
          if (conn !== ws && conn.readyState === 1) {
            conn.send(message);
          }
        }
        break;
      }
    }
  });

  ws.on("close", () => {
    docState.connections.delete(ws);
    console.log(`[sync] Client disconnected (${docState.connections.size} remaining)`);
  });

  console.log(`[sync] Client connected (${docState.connections.size} total)`);
}

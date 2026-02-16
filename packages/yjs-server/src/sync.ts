import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import type { WebSocket } from "ws";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

const connections = new Set<WebSocket>();

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

const observedRoots = new Set<string>();

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

function ensureDeepObservers(doc: Y.Doc): void {
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

export function setupYjsConnection(ws: WebSocket, doc: Y.Doc): void {
  connections.add(ws);

  // Send sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  ws.send(encoding.toUint8Array(encoder));

  // Listen for incoming messages
  ws.on("message", (data: ArrayBuffer | Buffer) => {
    const message = new Uint8Array(data as ArrayBuffer);
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MSG_SYNC: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, doc, null);
        // Attach deep observers to any newly created root types
        ensureDeepObservers(doc);
        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder));
        }
        break;
      }
      case MSG_AWARENESS: {
        // Relay raw awareness data to all other clients
        for (const conn of connections) {
          if (conn !== ws && conn.readyState === ws.OPEN) {
            conn.send(message);
          }
        }
        break;
      }
    }
  });

  // Broadcast doc updates to other clients
  const onUpdate = (update: Uint8Array, _origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const conn of connections) {
      if (conn !== ws && conn.readyState === ws.OPEN) {
        conn.send(message);
      }
    }
  };
  doc.on("update", onUpdate);

  ws.on("close", () => {
    connections.delete(ws);
    doc.off("update", onUpdate);
    console.log(`[sync] Client disconnected (${connections.size} remaining)`);
  });

  console.log(`[sync] Client connected (${connections.size} total)`);
}

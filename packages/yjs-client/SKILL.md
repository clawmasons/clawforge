# How to use @clawforge/yjs-client

You are writing TypeScript that connects to a ClawForge yjs-server over WebSocket. Use the `@clawforge/yjs-client` package. It handles the custom wire protocol, sync handshakes, and update forwarding automatically.

## Install

The package lives in the monorepo at `packages/yjs-client`. Add it as a dependency from any other workspace package:

```json
{ "dependencies": { "@clawforge/yjs-client": "workspace:*" } }
```

Then run `pnpm install` at the monorepo root.

## Imports

```ts
import { ClawforgeYjsClient } from "@clawforge/yjs-client";
// Optional — only needed if you inspect error payloads or event types:
import type { PermissionError, ClawforgeYjsClientOptions, ClawforgeYjsClientEvents } from "@clawforge/yjs-client";
```

In Node.js you also need the `ws` package:

```ts
import { WebSocket } from "ws";
```

## Connecting

The constructor opens a WebSocket immediately and begins the root document sync handshake.

### Browser

```ts
const client = new ClawforgeYjsClient({
  url: "ws://localhost:4444",
});
```

### Node.js

Pass the `ws` WebSocket constructor since `globalThis.WebSocket` does not exist in Node:

```ts
import { WebSocket } from "ws";

const client = new ClawforgeYjsClient({
  url: "ws://localhost:4444",
  WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
});
```

### With authentication

```ts
const client = new ClawforgeYjsClient({
  url: "ws://localhost:4444",
  token: "my-auth-token", // appended as ?token=my-auth-token
  WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
});
```

### With reconnection

```ts
const client = new ClawforgeYjsClient({
  url: "ws://localhost:4444",
  WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
  reconnect: true,    // default: false
  maxRetries: 5,      // default: 10
  backoff: 2000,      // base delay in ms, doubled each retry. default: 1000
});
```

## Waiting for sync

`client.synced` is a `Promise<void>` that resolves once the root document sync handshake completes. Always await it before reading or writing data:

```ts
await client.synced;
```

## Root document

`client.doc` is the root `Y.Doc`. You can read and write to it directly using the standard Yjs API:

```ts
const map = client.doc.getMap("settings");
map.set("theme", "dark");
```

Local changes are automatically forwarded to the server. Remote changes are automatically applied.

## Subspaces

The server organizes data into named subspaces. Each subspace is a separate `Y.Doc`. Access them lazily with `client.subspace(name)`:

```ts
const promptsDoc = client.subspace("prompts");
const presenceDoc = client.subspace("presence");
```

This returns a `Y.Doc` that syncs automatically. On first call it sends a sync request to the server; subsequent calls return the same doc. You can also access previously created subspaces via the map:

```ts
const doc = client.subspaces.get("prompts"); // Y.Doc | undefined
```

### Reading and writing subspace data

Use the standard Yjs API on the returned `Y.Doc`:

```ts
const promptsDoc = client.subspace("prompts");

// Write
const prompts = promptsDoc.getArray("prompts");
const entry = new Y.Map();
entry.set("prompt", "2+2");
entry.set("target", "math-bot");
prompts.push([entry]);

// Read / observe
prompts.observe((event) => {
  // handle changes
});
```

## Events

Subscribe with `client.on(event, listener)` and unsubscribe with `client.off(event, listener)`.

### `synced`

Fires once when the root doc sync handshake completes (same moment `client.synced` resolves):

```ts
client.on("synced", () => {
  console.log("root doc synced");
});
```

### `permissionError`

Fires when the server rejects an operation due to insufficient permissions. The connection stays open.

```ts
client.on("permissionError", (err) => {
  // err.error — always "permission_denied"
  // err.subspaces — which subspaces were denied
  console.error(`Denied: ${err.subspaces.join(", ")}`);
});
```

### `awareness`

Fires when an awareness update arrives from another client:

```ts
client.on("awareness", (update: Uint8Array) => {
  // apply to your awareness protocol instance
});
```

To send awareness updates:

```ts
client.sendAwareness(encodedUpdate);
```

### `close`

Fires when the WebSocket closes:

```ts
client.on("close", (code: number, reason: string) => {
  console.log(`Disconnected: ${code} ${reason}`);
});
```

### `error`

Fires on WebSocket errors:

```ts
client.on("error", (err) => {
  console.error("WebSocket error:", err);
});
```

## Closing

Always call `close()` when done. This removes all update listeners, destroys subspace docs, cancels reconnection timers, and closes the WebSocket:

```ts
client.close();
```

## Complete example: a bot that echoes prompts

```ts
import * as Y from "yjs";
import { WebSocket } from "ws";
import { ClawforgeYjsClient } from "@clawforge/yjs-client";

const client = new ClawforgeYjsClient({
  url: "ws://localhost:4444",
  token: "bot-token",
  WebSocket: WebSocket as unknown as typeof globalThis.WebSocket,
  reconnect: true,
});

await client.synced;

// Sync the prompts subspace
const promptsDoc = client.subspace("prompts");

// Wait a moment for subspace sync to complete
await new Promise((r) => setTimeout(r, 200));

// Observe new prompts and echo them back
const prompts: Y.Array<Y.Map<unknown>> = promptsDoc.getArray("prompts");
prompts.observe((event) => {
  for (const delta of event.changes.delta) {
    if (!("insert" in delta)) continue;
    for (const item of delta.insert as Y.Map<unknown>[]) {
      const text = item.get("prompt") as string;
      const replyArray = item.get("reply-to-array") as Y.Array<string> | undefined;
      if (replyArray) {
        replyArray.push([`echo: ${text}`]);
      }
    }
  }
});

// Handle permission errors
client.on("permissionError", (err) => {
  console.error("Permission denied for:", err.subspaces);
});

// Clean shutdown on SIGINT
process.on("SIGINT", () => {
  client.close();
  process.exit(0);
});
```

## Key rules

- **Always `await client.synced` before using data.** The root doc is empty until the sync handshake completes.
- **Call `client.subspace(name)` to access subspaces.** Do not manually create `Y.Doc` instances or encode wire protocol messages. The client handles all of this.
- **Permission errors are events, not exceptions.** The connection stays open after a permission error. Listen for them with `client.on("permissionError", ...)`.
- **All security is server-side.** The client provides no permission enforcement. Never trust client-side state for access control decisions.
- **Pass `WebSocket` from `ws` in Node.js.** The client defaults to `globalThis.WebSocket` which only exists in browsers.
- **Call `client.close()` when done.** This is required to clean up listeners and destroy Y.Doc instances.
- **Yjs types are from the `yjs` package.** Use `Y.Map`, `Y.Array`, `Y.Text`, etc. directly on the docs returned by `client.subspace()`.

# @clawforge/yjs-client

TypeScript client for the ClawForge yjs-server. Handles the full WebSocket connection lifecycle: root document sync, lazy subspace sync, awareness relay, permission error events, and optional reconnection with exponential backoff.

Works in both browser (native WebSocket) and Node.js (`ws`) environments.

## Usage

```ts
import { ClawforgeYjsClient } from "@clawforge/yjs-client";

const client = new ClawforgeYjsClient({
  url: "ws://localhost:4444",
  token: "optional-auth-token",
});

await client.synced; // root doc sync complete

const prompts = client.subspace("prompts"); // lazy sync
prompts.getArray("prompts").push([...]);

client.on("permissionError", (err) => {
  console.error(err.error, err.subspaces);
});

client.close();
```

For Node.js, pass the `ws` WebSocket constructor:

```ts
import { WebSocket } from "ws";

const client = new ClawforgeYjsClient({
  url: "ws://localhost:4444",
  WebSocket,
});
```

## Build

From this directory (requires `pnpm install` at the monorepo root first):

```bash
pnpm build    # runs tsc, outputs to dist/
pnpm clean    # removes dist/
```

## Tests

This package has no tests of its own. It is tested via the `@clawforge/yjs-server` test suite, which imports it as a dev dependency. To run those tests:

```bash
cd ../yjs-server
pnpm test
```

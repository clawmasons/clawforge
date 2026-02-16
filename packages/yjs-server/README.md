# @clawforge/yjs-server

WebSocket server for real-time collaboration using [Yjs](https://yjs.dev/). Handles document sync between clients, glob-pattern watchers for observing document changes, and file-based persistence.

## Architecture

```
src/
  server.ts       — HTTP + WebSocket server, auth gating, graceful shutdown
  sync.ts         — Yjs sync protocol, observeDeep watchers, watch-event hooks
  auth.ts         — Token authentication against the Clawforge API (stubbed)
  persistence.ts  — Debounced atomic file persistence for Y.Doc state
```

### Server (`server.ts`)

Runs an HTTP server that upgrades WebSocket connections after authentication. All clients share a single `Y.Doc` instance. Document state is persisted to disk via `FilePersistence`.

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `CLAWFORGE_API_URL` | `http://localhost:4000` | API base URL for auth |
| `CLAWFORGE_TOKEN` | `""` | Server-to-API auth token |
| `PROGRAM_ID` | `"default"` | Program identifier for data file naming |
| `DATA_DIR` | `/home/pn/data` | Directory for persistence files |
| `PORT` | `1234` | WebSocket server port |

### Sync & Watchers (`sync.ts`)

`setupYjsConnection(ws, doc)` handles the Yjs sync protocol (sync steps + update relay) and awareness message forwarding between clients.

#### Glob-pattern watchers

The module defines path-pattern watchers that match against `observeDeep` change events:

| Pattern | Message | Fires when |
|---|---|---|
| `prompts[*]` | New prompt added | A prompt is inserted into the prompts array |
| `prompts[*].reply-to-array` | Reply received | A reply is pushed to a prompt's reply array |
| `presence.*.status` | Status changed | A bot/user's status field is updated |
| `presence.*` | Presence updated | A new presence entry is added |

Patterns use glob syntax: `*` matches a single path segment, `**` matches any depth.

#### Watch-event hooks

Watchers fire `WatchEvent` objects through a hook system instead of logging directly. This makes the watchers testable and extensible.

```ts
import { onWatch, type WatchEvent } from "@clawforge/yjs-server/sync";

const unsubscribe = onWatch((event: WatchEvent) => {
  // event.path    — "prompts[0].reply-to-array"
  // event.pattern — "prompts[*].reply-to-array"
  // event.message — "Reply received"
  // event.action  — "insert"
  // event.value   — '"2+2=4"'
});

// Later: unsubscribe()
```

A default console-logging hook is registered at module load to preserve dev-server output.

#### AbstractType handling

When shared types arrive via remote sync, Yjs stores them as `AbstractType` in `doc.share`. `observeDeep` on `AbstractType` does not fire for direct (depth-0) changes. The `ensureDeepObservers` function detects this and converts to the proper typed version (`YArray`/`YMap`) using `doc.getArray()`/`doc.getMap()` before attaching observers. The correct type is inferred from watcher patterns.

### Persistence (`persistence.ts`)

`FilePersistence` listens to doc updates and writes the full state to disk with a 1-second debounce. Writes are atomic (write to `.tmp`, then rename). Call `flush()` on shutdown to ensure pending state is saved.

## Running

```bash
# Development (watches for changes)
pnpm dev

# Build
pnpm build
```

## Tests

```bash
pnpm test
```

Runs 10 integration tests using Node's built-in test runner:

- **Math-bot tests (6)** — Two clients (bot + student) connected via WebSocket. Student sends math expressions, bot evaluates and replies. Tests verify correct evaluation, reply delivery, and presence visibility across clients.
- **Watcher tests (4)** — Verify that `observeDeep` watchers fire the correct `WatchEvent` for prompt inserts, reply inserts, status changes, and presence updates.

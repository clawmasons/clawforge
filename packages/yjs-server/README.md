# @clawforge/yjs-server

WebSocket server for real-time collaboration using [Yjs](https://yjs.dev/). Handles document sync between clients with subspace-scoped permissions, glob-pattern watchers for observing document changes, and file-based persistence.

## Architecture

```
src/
  server.ts       — HTTP + WebSocket server, auth gating, graceful shutdown
  sync.ts         — Yjs sync protocol, subspace routing, permission enforcement, watchers
  auth.ts         — Token authentication against the Clawforge API (stubbed)
  permissions.ts  — Permission parsing, hierarchy expansion, authorization checks
  persistence.ts  — Debounced atomic file persistence for Y.Doc state
```

### Permissions (`permissions.ts`)

Pure-logic module for subspace-level authorization. No I/O, independently testable.

**Permission string format:** `<subspace>:<right>`

- Root document: `:read` (empty subspace name)
- Subspace: `prompts:write`, `presence:observe`, `internal.chat:read`

**Rights hierarchy:** `write` > `observe` > `read`

- `read` — receive initial subspace state on sync, no live updates
- `observe` (implies `read`) — initial state + ongoing update broadcasts
- `write` (implies `observe` + `read`) — full access: initial state, live updates, and can apply changes

```ts
import { parsePermission, buildPermissions, hasRight } from "./permissions.js";

const perms = buildPermissions([":read", "prompts:write", "presence:observe"]);
hasRight(perms, "prompts", "observe"); // true (write implies observe)
hasRight(perms, "presence", "write");  // false (observe does not imply write)
```

### Server (`server.ts`)

Runs an HTTP server that upgrades WebSocket connections after authentication. Permissions from the auth result are threaded through to the sync layer.

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `CLAWFORGE_API_URL` | `http://localhost:4000` | API base URL for auth |
| `CLAWFORGE_TOKEN` | `""` | Server-to-API auth token |
| `PROGRAM_ID` | `"default"` | Program identifier for data file naming |
| `DATA_DIR` | `/home/pn/data` | Directory for persistence files |
| `PORT` | `1234` | WebSocket server port |

### Auth (`auth.ts`)

`authenticateProgram` returns an `AuthResult` with a `permissions: string[]` field. The stub returns `[":read"]` (root document read-only). Tests pass explicit permission sets to bypass the stub.

### Sync & Subspaces (`sync.ts`)

`setupYjsConnection(ws, doc, permissions?)` handles the Yjs sync protocol with subspace-scoped permission enforcement.

#### Subspace model

Memory is organized into subspaces, each backed by its own `Y.Doc`. Subspaces sync independently from the root document, making permission enforcement trivial — each subspace has its own sync handshake and update stream.

**Lazy loading:** Subspaces are loaded on demand. The server only syncs the root document on connect. When a client wants a subspace, it sends `MSG_SUBSPACE_SYNC` step1; the server checks permissions and responds with step2 (the actual data).

#### Wire format

| Type | Value | Description |
|---|---|---|
| `MSG_SYNC` | 0 | Root document sync (unchanged from standard y-protocols) |
| `MSG_AWARENESS` | 1 | Awareness messages (relayed to all clients) |
| `MSG_SUBSPACE_SYNC` | 2 | Subspace sync: `[2][varstring: subspace name][sync protocol bytes]` |
| `MSG_PERMISSION_ERROR` | 3 | Permission denied: `[3][varstring: JSON payload]` |

Permission error payload: `{ "error": "permission_denied", "subspaces": ["prompts"] }`

#### Permission enforcement

- **Read:** client can only sync subspaces it has `read` permission for
- **Write:** incoming `messageYjsUpdate` messages are checked against `write` permission; rejected writes produce `MSG_PERMISSION_ERROR`
- **Observe:** update broadcasts are only relayed to connections with `observe` (or `write`) right on the subspace; `read`-only connections get initial state but no live updates

#### Glob-pattern watchers

Path-pattern watchers match against `observeDeep` change events on both the root document and subspace documents:

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

Runs 36 tests across 3 suites using Node's built-in test runner:

- **Permission unit tests (20)** — `parsePermission` validation, `buildPermissions` hierarchy expansion and deduplication, `hasRight` hierarchy-implied checks
- **Sync enforcement tests (6)** — Write rejection for read-only connections, write success for write connections, observe filtering (live updates vs read-only snapshot), read enforcement (authorized vs unauthorized subspaces), stub auth defaults
- **Math-bot integration tests (10)** — Two clients (bot + student) connected via WebSocket with explicit permissions (`prompts:write`, `presence:write`). Student sends math expressions, bot evaluates and replies through subspace docs. Tests verify correct evaluation, reply delivery, presence visibility, and watcher events.

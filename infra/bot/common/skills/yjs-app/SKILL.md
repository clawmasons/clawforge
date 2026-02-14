# Yjs App Skill

Build a single-page application that sends prompts to a clawbot and receives streaming responses over a shared Yjs document.

## Architecture

```
 SPA (browser)                    yjs-server (ws://...)                 clawbot (yjs-plugin)
 ─────────────                    ────────────────────                  ────────────────────
 Connect via WebSocket ──────────► Shared Y.Doc ◄────────────────────── Observes Y.Doc
 Append Y.Map to prompts array    Syncs all peers                      Reads new prompts
 Observe reply-to-stream/array    Persists to disk                     Writes responses back
```

The SPA and the bot are both Yjs peers connected to the same document. Communication happens through two shared types on the `Y.Doc`:

- **`prompts`** (`Y.Array<Y.Map>`) — the prompt queue
- **`presence`** (`Y.Map<Y.Map>`) — per-entity presence (see [Presence](#presence) below)

## Prompt Y.Map Schema

Each prompt is a `Y.Map` appended to the `prompts` array. The SPA creates and populates it; the bot reads it and writes responses back into it.

| Key               | Yjs Type    | Set by | Description                                      |
| ----------------- | ----------- | ------ | ------------------------------------------------ |
| `prompt`          | `string`    | SPA    | The user's message text                          |
| `target`          | `string`    | SPA    | Target bot name, or `"*"` for any bot            |
| `reply-to-stream` | `Y.Text`    | SPA    | Bot inserts streaming chunks here as they arrive |
| `reply-to-array`  | `Y.Array`   | SPA    | Bot pushes the final complete response string    |

The SPA **must** create the `reply-to-stream` and `reply-to-array` Yjs types inside the Y.Map before appending it to the prompts array. The bot only reads and writes into them.

## Presence

Presence is a **Map-of-Maps**. The outer `Y.Map` is keyed by entity name (lowercase, snake_cased). Each inner `Y.Map` contains:

| Key          | Type     | Description                                              |
| ------------ | -------- | -------------------------------------------------------- |
| `status`     | `string` | `"waiting"` \| `"thinking"` \| `"offline"`               |
| `type`       | `string` | `"bot"` \| `"user"`                                      |
| `lastUpdate` | `string` | ISO 8601 timestamp (e.g. `"2026-02-14T12:34:56.789Z"`)  |
| `timezone`   | `string` | IANA timezone (e.g. `"America/New_York"`) — set on connect |

```
presence (Y.Map)
  └─ "my_bot" (Y.Map)
       ├─ status: "waiting"
       ├─ type: "bot"
       ├─ lastUpdate: "2026-02-14T12:34:56.789Z"
       └─ timezone: "America/New_York"
  └─ "some_user" (Y.Map)
       ├─ status: "waiting"
       ├─ type: "user"
       ├─ lastUpdate: "2026-02-14T12:35:00.000Z"
       └─ timezone: "Europe/London"
```

The bot automatically manages its own presence entry. The SPA should register its own presence entry with `type: "user"` after connecting (see [Registering SPA Presence](#registering-spa-presence)).

The presence key is derived from the entity's display name by lowercasing, replacing non-alphanumeric runs with `_`, and trimming leading/trailing underscores. Apps can use these presence keys for features like direct messages by setting the `target` field to a specific entity's presence key.

## Authentication

The yjs-server authenticates WebSocket connections via a `token` query parameter (`ws://host:port?token=TOKEN`). The SPA needs three values to connect:

- **`host`** — the WebSocket URL of the yjs-server (e.g. `ws://yjs-server:1234`)
- **`token`** — the auth token passed as `?token=` on the WebSocket URL
- **`name`** — the user's display name (used to derive the presence key)

### Requesting connection info from a parent frame

If your SPA runs inside an iframe, request all values from the parent window:

```js
window.parent.postMessage({ type: 'REQUEST_CONNECTION_INFO' }, 'https://parent-origin.com');

window.addEventListener('message', (event) => {
  if (event.origin !== 'https://parent-origin.com') return;
  if (event.data?.type === 'CONNECTION_INFO') {
    connectToYjs(event.data.host, event.data.token, event.data.name);
  }
});
```

The parent should respond with:

```js
// Inside the parent window
window.addEventListener('message', (event) => {
  if (event.data?.type === 'REQUEST_CONNECTION_INFO') {
    event.source.postMessage({
      type: 'CONNECTION_INFO',
      host: 'ws://yjs-server:1234',
      token: 'the-auth-token',
      name: 'Alice',
    }, event.origin);
  }
});
```

### Fallback: manual input

If the parent does not respond (no iframe, or the parent doesn't handle the message), prompt the user for all values:

```js
function requestConnectionInfo() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      // No response from parent — ask the user
      const host = prompt('Enter the Yjs WebSocket host (e.g. ws://localhost:1234):');
      const token = prompt('Enter your connection token:');
      const name = prompt('Enter your name:');
      resolve(host && token && name ? { host, token, name } : null);
    }, 2000);

    window.parent.postMessage({ type: 'REQUEST_CONNECTION_INFO' }, '*');

    window.addEventListener('message', function handler(event) {
      if (event.data?.type === 'CONNECTION_INFO') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        resolve({ host: event.data.host, token: event.data.token, name: event.data.name });
      }
    });
  });
}
```

## Connecting to the Yjs Document

Use `y-websocket` to connect to the yjs-server. Pass `host` as the server URL and `token` via the query parameter. The document name in the URL path determines which shared document you join.

```js
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const doc = new Y.Doc();

function connectToYjs(host, token, name) {
  const provider = new WebsocketProvider(
    host,             // e.g. ws://yjs-server:1234
    'doc-name',       // room / document name
    doc,
    { params: { token } }
  );

  const prompts = doc.getArray('prompts');
  const presence = doc.getMap('presence');

  provider.on('sync', () => {
    console.log('Synced with yjs-server');
  });
}
```

## Presence Key Helper

Derive a stable presence key from a display name. Lowercase, replace non-alphanumeric runs with `_`, trim leading/trailing underscores:

```js
function toPresenceKey(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// Examples:
// "Alice"        → "alice"
// "My Bot"       → "my_bot"
// "Dr. Strange!" → "dr_strange"
```

## Sending a Prompt

Create a `Y.Map` with all required fields, then append it to the `prompts` array in a single transaction:

```js
function sendPrompt(doc, text, targetName = '*') {
  const prompts = doc.getArray('prompts');

  const promptMap = new Y.Map();
  const replyStream = new Y.Text();
  const replyArray = new Y.Array();

  doc.transact(() => {
    promptMap.set('prompt', text);
    promptMap.set('target', targetName);
    promptMap.set('reply-to-stream', replyStream);
    promptMap.set('reply-to-array', replyArray);
    prompts.push([promptMap]);
  });

  return { promptMap, replyStream, replyArray };
}
```

## Observing Streaming Responses

After sending a prompt, observe the `reply-to-stream` Y.Text for incremental chunks and the `reply-to-array` for the final complete response:

```js
function observeResponse({ replyStream, replyArray }, callbacks) {
  // Streaming chunks — update UI incrementally
  replyStream.observe(() => {
    callbacks.onStream(replyStream.toString());
  });

  // Final complete response
  replyArray.observe(() => {
    if (replyArray.length > 0) {
      callbacks.onComplete(replyArray.get(0));
    }
  });
}
```

## Observing Presence

Watch the `presence` map to show status indicators for all entities. Use `observeDeep` on the outer map to catch changes to any inner map:

```js
const presence = doc.getMap('presence');

presence.observeDeep(() => {
  for (const [name, inner] of presence.entries()) {
    const status = inner.get('status');     // "waiting" | "thinking" | "offline"
    const type = inner.get('type');         // "bot" | "user"
    const lastUpdate = inner.get('lastUpdate');
    updateEntityStatus(name, { status, type, lastUpdate });
  }
});
```

## Registering SPA Presence

After connecting and syncing, the SPA should derive its presence key from the user's `name` and register with `type: "user"`:

```js
provider.on('sync', () => {
  const presence = doc.getMap('presence');
  const presenceKey = toPresenceKey(name);
  const userPresence = new Y.Map();
  userPresence.set('status', 'waiting');
  userPresence.set('type', 'user');
  userPresence.set('lastUpdate', new Date().toISOString());
  userPresence.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  presence.set(presenceKey, userPresence);
});
```

## Full Chat Example

Putting it all together — a minimal chat flow:

```js
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const doc = new Y.Doc();
const prompts = doc.getArray('prompts');
const presence = doc.getMap('presence');

function toPresenceKey(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

async function init() {
  const connInfo = await requestConnectionInfo();
  if (!connInfo) {
    console.error('No connection info available');
    return;
  }

  const { host, token, name } = connInfo;
  const presenceKey = toPresenceKey(name);

  const provider = new WebsocketProvider(host, 'doc', doc, {
    params: { token },
  });

  provider.on('sync', () => {
    console.log('Connected and synced');

    // Register SPA user presence
    const userPresence = new Y.Map();
    userPresence.set('status', 'waiting');
    userPresence.set('type', 'user');
    userPresence.set('lastUpdate', new Date().toISOString());
    userPresence.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    presence.set(presenceKey, userPresence);
  });

  // Watch presence for status changes (bots + users)
  presence.observeDeep(() => {
    for (const [name, inner] of presence.entries()) {
      const status = inner.get('status');
      const type = inner.get('type');
      updateEntityStatus(name, { status, type }); // e.g. show thinking indicator for bots
    }
  });
}

function chat(text, targetName = '*') {
  const promptMap = new Y.Map();
  const replyStream = new Y.Text();
  const replyArray = new Y.Array();

  doc.transact(() => {
    promptMap.set('prompt', text);
    promptMap.set('target', targetName);
    promptMap.set('reply-to-stream', replyStream);
    promptMap.set('reply-to-array', replyArray);
    prompts.push([promptMap]);
  });

  // Show streaming text as it arrives
  replyStream.observe(() => {
    renderStreamingMessage(replyStream.toString());
  });

  // Finalize when complete
  replyArray.observe(() => {
    if (replyArray.length > 0) {
      renderFinalMessage(replyArray.get(0));
    }
  });
}
```

## Key Points

- Always create `reply-to-stream` (`Y.Text`) and `reply-to-array` (`Y.Array`) as Yjs types and set them on the prompt Y.Map **before** appending to the prompts array.
- Use `doc.transact()` to batch the prompt creation into a single update.
- The `target` field filters which bot picks up the prompt. Use `"*"` to let any bot respond.
- Presence is a Map-of-Maps: outer key is entity name (snake_cased), inner map has `status`, `type`, `lastUpdate`, and `timezone`.
- Derive presence keys from display names using `toPresenceKey()` — lowercase, replace special chars with `_`, trim edges. These keys can also be used for direct messaging via the `target` field.
- Bots set status to `"thinking"` when processing and `"waiting"` when done. They set `"offline"` on disconnect.
- The SPA should register its own presence entry with `type: "user"` after syncing.
- Use `presence.observeDeep()` to watch for changes across all entities.
- The `reply-to-stream` Y.Text receives incremental chunks during generation — observe it to render a live typing effect.
- The `reply-to-array` receives the final complete response string once the bot is done.
- Always attempt `window.parent.postMessage({ type: 'REQUEST_CONNECTION_INFO' })` first to get `host`, `token`, and `name`; fall back to prompting the user for all values if no response arrives.

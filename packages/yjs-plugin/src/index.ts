import * as Y from "yjs";
import { YjsClient } from "./yjs-client.js";
import { createYjsChannel } from "./channel.js";
import type { YjsPluginConfig } from "./types.js";

/** Lowercase and replace non-alphanumeric runs with `_`, trim edges. */
function toSnakeCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export default function register(api: any): void {
  const host = process.env.YJS_HOST;
  if (!host) {
    console.log("[yjs-plugin] YJS_HOST not set — plugin disabled");
    return;
  }

  const botName = process.env.BOT_NAME;
  if (!botName) {
    console.log("[yjs-plugin] BOT_NAME not set — plugin disabled");
    return;
  }

  const config: YjsPluginConfig = {
    host,
    token: process.env.YJS_TOKEN,
    botName,
  };

  const client = new YjsClient(config);
  const channel = createYjsChannel(client, config.botName);
  const presenceKey = toSnakeCase(botName);

  api.registerChannel({ plugin: channel });

  api.registerService({
    start: async () => {
      client.start();
      await client.synced;

      // Set initial presence after sync
      const presence: Y.Map<Y.Map<string>> = client.doc.getMap("presence");
      const inner = new Y.Map<string>();
      inner.set("status", "waiting");
      inner.set("type", "bot");
      inner.set("lastUpdate", new Date().toISOString());
      inner.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      presence.set(presenceKey, inner);

      console.log("[yjs-plugin] Service started and synced");
    },
    stop: async () => {
      // Set offline presence before disconnecting
      const presence: Y.Map<Y.Map<string>> = client.doc.getMap("presence");
      const inner = presence.get(presenceKey);
      if (inner) {
        inner.set("status", "offline");
        inner.set("lastUpdate", new Date().toISOString());
      }

      client.stop();
      console.log("[yjs-plugin] Service stopped");
    },
  });

  console.log("[yjs-plugin] Registered channel and service");
}

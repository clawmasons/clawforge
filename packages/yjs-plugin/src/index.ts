import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import * as Y from "yjs";
import { YjsClient } from "./yjs-client.js";
import { createYjsChannel } from "./channel.js";
import { YjsConfigSchema, type YjsConfig } from "./config-schema.js";
import type { YjsPluginConfig } from "./types.js";

/** Lowercase and replace non-alphanumeric runs with `_`, trim edges. */
function toSnakeCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const yjsPlugin = {
  id: "yjs",
  name: "YJS",
  description: "Yjs collaborative channel plugin",

  register(api: OpenClawPluginApi): void {
    // Parse and validate configuration
    let config: YjsConfig;
    try {
      config = YjsConfigSchema.parse(api.pluginConfig);
    } catch (err) {
      api.logger.error(`[yjs] Invalid configuration: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    if (!config.enabled) {
      api.logger.info("[yjs] Plugin disabled in configuration");
      return;
    }

    if (!config.host) {
      api.logger.warn("[yjs] host not configured — plugin disabled");
      return;
    }

    if (!config.botName) {
      api.logger.warn("[yjs] botName not configured — plugin disabled");
      return;
    }

    const clientConfig: YjsPluginConfig = {
      host: config.host,
      token: config.token,
      botName: config.botName,
    };

    const client = new YjsClient(clientConfig);
    const channel = createYjsChannel(client, config.botName, api.logger);
    const presenceKey = toSnakeCase(config.botName);

    api.registerChannel({ plugin: channel });

    api.registerService({
      id: "yjs",
      start: async () => {
        try {
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

          // Start observing prompts array AFTER sync
          channel.startObserving(api);

          api.logger.info("[yjs] Service started and synced, observing prompts array");
        } catch (err) {
          api.logger.error(`[yjs] Failed to start service: ${err instanceof Error ? err.message : String(err)}`);
          throw err;
        }
      },
      stop: async () => {
        try {
          // Set offline presence before disconnecting
          const presence: Y.Map<Y.Map<string>> = client.doc.getMap("presence");
          const inner = presence.get(presenceKey);
          if (inner) {
            inner.set("status", "offline");
            inner.set("lastUpdate", new Date().toISOString());
          }

          client.stop();
          api.logger.info("[yjs] Service stopped");
        } catch (err) {
          api.logger.error(`[yjs] Error during service stop: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    });

    api.logger.info("[yjs] Registered channel and service");
  },
};

export default yjsPlugin;

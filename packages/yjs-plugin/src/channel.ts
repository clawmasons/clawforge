import * as Y from "yjs";
import type { YjsClient } from "./yjs-client.js";

/** Lowercase and replace non-alphanumeric runs with `_`, trim edges. */
function toSnakeCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Creates a channel plugin that bridges the `prompts` Y.Array and `presence`
 * Y.Map to openclaw messages.
 *
 * Inbound:  New Y.Map items appended to `prompts` are dispatched as messages.
 * Outbound: Streaming chunks go to `reply-to-stream` Y.Text, final responses
 *           are pushed to `reply-to-array` Y.Array.
 */
export function createYjsChannel(client: YjsClient, botName: string) {
  const prompts: Y.Array<Y.Map<unknown>> = client.doc.getArray("prompts");
  const presence: Y.Map<Y.Map<string>> = client.doc.getMap("presence");
  const presenceKey = toSnakeCase(botName);

  /** Track how many items existed after initial sync so we skip history */
  let baseLength = 0;

  /** Get-or-create the inner presence map and set status + lastUpdate. */
  function setPresence(status: string): void {
    let inner = presence.get(presenceKey);
    if (!inner) {
      inner = new Y.Map<string>();
      presence.set(presenceKey, inner);
    }
    inner.set("status", status);
    inner.set("type", "bot");
    inner.set("lastUpdate", new Date().toISOString());
  }

  function startObserving(api: any): void {
    // Snapshot current length — everything before this is history
    baseLength = prompts.length;

    prompts.observe((event: Y.YArrayEvent<Y.Map<unknown>>) => {
      if (!client.isSynced) return;

      let index = 0;
      for (const delta of event.changes.delta) {
        if ("retain" in delta) {
          index += delta.retain!;
          continue;
        }
        if ("insert" in delta) {
          const items = delta.insert as Y.Map<unknown>[];
          for (const promptMap of items) {
            // Only process items appended after our sync baseline
            if (index < baseLength) {
              index++;
              continue;
            }

            const targetBot = promptMap.get("target") as string | undefined;
            if (targetBot !== "*" && targetBot !== botName) {
              index++;
              continue;
            }

            const text = promptMap.get("prompt") as string | undefined;
            if (!text) {
              index++;
              continue;
            }

            console.log(
              `[yjs-plugin] Inbound prompt [${index}]: ${text.slice(0, 80)}`,
            );

            setPresence("thinking");

            api.runtime.channel.reply.handleInboundMessage({
              channelName: "yjs",
              accountId: "default",
              sessionKey: String(index),
              envelope: {
                text,
                senderId: "yjs-user",
                senderName: "yjs-user",
                timestamp: Date.now(),
              },
            });

            index++;
          }
          continue;
        }
        if ("delete" in delta) {
          // Deletions don't produce new prompts
          continue;
        }
      }
    });
  }

  function sendText(sessionKey: string, text: string): void {
    const idx = Number(sessionKey);
    const promptMap = prompts.get(idx) as Y.Map<unknown> | undefined;
    if (!promptMap) {
      console.warn(`[yjs-plugin] sendText: no prompt at index ${idx}`);
      return;
    }

    const stream = promptMap.get("reply-to-stream") as Y.Text | undefined;
    if (!stream) {
      console.warn(`[yjs-plugin] sendText: no reply-to-stream at index ${idx}`);
      return;
    }

    stream.insert(stream.length, text);
  }

  function completeResponse(sessionKey: string, text: string): void {
    const idx = Number(sessionKey);
    const promptMap = prompts.get(idx) as Y.Map<unknown> | undefined;
    if (!promptMap) {
      console.warn(`[yjs-plugin] completeResponse: no prompt at index ${idx}`);
      return;
    }

    const arr = promptMap.get("reply-to-array") as Y.Array<string> | undefined;
    if (!arr) {
      console.warn(
        `[yjs-plugin] completeResponse: no reply-to-array at index ${idx}`,
      );
      return;
    }

    arr.push([text]);
    setPresence("waiting");

    console.log(
      `[yjs-plugin] Response complete [${idx}]: ${text.slice(0, 80)}`,
    );
  }

  return {
    name: "yjs",
    startObserving,
    sendText,
    completeResponse,
  };
}

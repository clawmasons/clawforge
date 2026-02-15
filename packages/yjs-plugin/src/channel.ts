import * as Y from "yjs";
import type { YjsClient } from "./yjs-client.js";
import type { OpenClawPluginApi, ReplyPayload } from "openclaw/plugin-sdk";
import { createReplyPrefixOptions } from "openclaw/plugin-sdk";

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

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
export function createYjsChannel(client: YjsClient, botName: string, logger: Logger) {
  const prompts: Y.Array<Y.Map<unknown>> = client.doc.getArray("prompts");
  const presence: Y.Map<Y.Map<string>> = client.doc.getMap("presence");
  const presenceKey = toSnakeCase(botName);

  /** Track how many items existed after initial sync so we skip history */
  let baseLength = 0;

  /** Map session keys to their reply targets */
  const sessionReplyTargets = new Map<string, {
    array: Y.Array<unknown>;
    replyText: Y.Text | null;
  }>();

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

  function startObserving(api: OpenClawPluginApi): void {
    // Snapshot current length — everything before this is history
    baseLength = prompts.length;
    logger.info(`[yjs] Started observing prompts array (baseLength: ${baseLength})`);

    prompts.observe(async (event: Y.YArrayEvent<Y.Map<unknown>>) => {
      logger.info(`[yjs] ========== Observer fired ==========`);
      logger.info(`[yjs] Prompts array changed, isSynced: ${client.isSynced}, currentLength: ${prompts.length}, baseLength: ${baseLength}`);
      logger.info(`[yjs] Delta count: ${event.changes.delta.length}`);

      if (!client.isSynced) {
        logger.info(`[yjs] Skipping event - not synced yet`);
        return;
      }

      let index = 0;
      for (let i = 0; i < event.changes.delta.length; i++) {
        const delta = event.changes.delta[i];
        logger.info(`[yjs] Processing delta ${i}: ${JSON.stringify(delta).slice(0, 200)}`);

        if ("retain" in delta) {
          logger.info(`[yjs] Delta ${i}: retain ${delta.retain}, index ${index} -> ${index + delta.retain!}`);
          index += delta.retain!;
          continue;
        }
        if ("insert" in delta) {
          const items = delta.insert as Y.Map<unknown>[];
          logger.info(`[yjs] Delta ${i}: insert ${items.length} items at index ${index}`);

          for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
            const promptMap = items[itemIdx];
            logger.info(`[yjs] --- Processing item ${itemIdx} at array index ${index} ---`);

            // Only process items appended after our sync baseline
            if (index < baseLength) {
              logger.info(`[yjs] ❌ Skipping index ${index} (< baseLength ${baseLength})`);
              index++;
              continue;
            }
            logger.info(`[yjs] ✓ Index ${index} >= baseLength ${baseLength}, proceeding`);

            const targetBot = promptMap.get("target") as string | undefined;
            logger.info(`[yjs] Item ${index}: target="${targetBot}", botName="${botName}"`);

            if (targetBot !== "*" && targetBot !== botName) {
              logger.info(`[yjs] ❌ Skipping index ${index} - not targeted at this bot (target: ${targetBot})`);
              index++;
              continue;
            }
            logger.info(`[yjs] ✓ Target matches, proceeding`);

            const text = promptMap.get("prompt") as string | undefined;
            if (!text) {
              logger.info(`[yjs] ❌ Skipping index ${index} - no prompt text`);
              index++;
              continue;
            }
            logger.info(`[yjs] ✓ Got prompt text (${text.length} chars)`);

            // Get the reply array from the promptMap
            const replyArray = promptMap.get("reply-to-array") as Y.Array<unknown> | undefined;

            if (!replyArray) {
              logger.warn(`[yjs] ❌ Skipping index ${index} - missing reply-to-array`);
              index++;
              continue;
            }
            logger.info(`[yjs] ✓ Got reply-to-array`);

            // Wrap entire dispatch in try-catch to catch any errors
            try {
              // Dispatch message to agent using proper runtime API - get route FIRST to get proper sessionKey
              const route = api.runtime.channel.routing.resolveAgentRoute({
                cfg: api.config,
                channel: "yjs",
                accountId: "default",
                peer: { kind: "direct", id: "yjs-user" },
              });

              // Use route.sessionKey (NOT a custom key) to align with OpenClaw's routing system
              sessionReplyTargets.set(route.sessionKey, { array: replyArray, replyText: null });
              logger.info(`[yjs] ✓ Created session ${route.sessionKey} for message at index ${index}`);

              logger.info(
                `[yjs] 🚀 Dispatching inbound prompt [${index}] (session: ${route.sessionKey}): ${text.slice(0, 80)}`,
              );

              setPresence("thinking");

              const storePath = api.runtime.channel.session.resolveStorePath(api.config.session?.store, {
                agentId: route.agentId,
              });

              const envelopeOptions = api.runtime.channel.reply.resolveEnvelopeFormatOptions(api.config);
              const previousTimestamp = api.runtime.channel.session.readSessionUpdatedAt({
                storePath,
                sessionKey: route.sessionKey,
              });

              const body = api.runtime.channel.reply.formatAgentEnvelope({
                channel: "YJS",
                from: "YJS User",
                timestamp: Date.now(),
                previousTimestamp,
                envelope: envelopeOptions,
                body: text,
              });

              const ctxPayload = api.runtime.channel.reply.finalizeInboundContext({
                Body: body,
                RawBody: text,
                CommandBody: text,
                From: "yjs:user:yjs-user",
                To: "yjs:default",
                SessionKey: route.sessionKey,
                AccountId: "default",
                ChatType: "direct",
                SenderName: "YJS User",
                SenderId: "yjs-user",
                Provider: "yjs",
                Surface: "yjs",
                OriginatingChannel: "yjs",
                OriginatingTo: "yjs:default",
              });

              logger.info(`[yjs] Recording inbound session for ${route.sessionKey}`);

              // Record inbound session (required pattern from other plugins)
              await api.runtime.channel.session.recordInboundSession({
                storePath,
                sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
                ctx: ctxPayload,
                onRecordError: (err) => {
                  logger.error(`[yjs] failed updating session meta: ${String(err)}`);
                },
              });

              logger.info(`[yjs] Session recorded successfully for ${route.sessionKey}`);

              const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
                cfg: api.config,
                agentId: route.agentId,
                channel: "yjs",
                accountId: "default",
              });

              // Track accumulated response for debugging
              let accumulatedResponse = "";

              logger.info(`[yjs] Calling dispatchReplyWithBufferedBlockDispatcher for session ${route.sessionKey}`);

              // Dispatch the reply with proper delivery handler (AWAIT like IRC plugin does)
              await api.runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
                ctx: ctxPayload,
                cfg: api.config,
                dispatcherOptions: {
                  ...prefixOptions,
                  deliver: async (payload: ReplyPayload, opts?: { kind?: string }) => {
                    try {
                      logger.info(`[yjs] 📨 Deliver called for session ${route.sessionKey}, hasText: ${!!payload.text}, kind: ${opts?.kind}`);

                      if (!payload.text) return;

                      const kind = opts?.kind || "unknown";
                      const targets = sessionReplyTargets.get(route.sessionKey);

                      if (!targets) {
                        logger.error(`[yjs] No reply targets found for session ${route.sessionKey}`);
                        return;
                      }

                      accumulatedResponse += payload.text;

                      logger.info(`[yjs] Delivering ${kind} for session ${route.sessionKey}: ${payload.text.slice(0, 50)}`);

                      // For all chunks, append to the Y.Text object in the array
                      if (targets.replyText === null) {
                        // First chunk - create a Y.Text and push to array
                        targets.replyText = new Y.Text();
                        targets.replyText.insert(0, payload.text);
                        targets.array.push([targets.replyText]);
                        logger.info(`[yjs] Started streaming to new Y.Text in array (index: ${targets.array.length - 1})`);
                      } else {
                        // Subsequent chunks - append to the existing Y.Text
                        targets.replyText.insert(targets.replyText.length, payload.text);
                        logger.info(`[yjs] Appended to Y.Text (total length: ${targets.replyText.length})`);
                      }

                      // If this is the final message, clean up and update presence
                      if (kind === "final") {
                        setPresence("waiting");
                        sessionReplyTargets.delete(route.sessionKey);
                        logger.info(`[yjs] Completed response for session ${route.sessionKey}: ${accumulatedResponse.length} chars`);
                      }
                    } catch (err) {
                      logger.error(`[yjs] Failed to deliver reply: ${err instanceof Error ? err.message : String(err)}`);
                    }
                  },
                  onError: (err, info) => {
                    logger.error(`[yjs] ${info.kind} reply failed: ${String(err)}`);
                  },
                },
                replyOptions: {
                  onModelSelected,
                },
              });

              logger.info(`[yjs] ✓ Dispatch completed for session ${route.sessionKey}`);
            } catch (err) {
              logger.error(`[yjs] ❌ Failed to process message at index ${index}: ${err instanceof Error ? err.message : String(err)}`);
              if (err instanceof Error && err.stack) {
                logger.error(`[yjs] Stack trace: ${err.stack}`);
              }
            }

            index++;
          }
          continue;
        }
        if ("delete" in delta) {
          logger.info(`[yjs] Delta ${i}: delete (skipping)`);
          // Deletions don't produce new prompts
          continue;
        }
      }
      logger.info(`[yjs] ========== Observer completed ==========`);
    });
  }

  function sendText(sessionKey: string, text: string): void {
    const idx = Number(sessionKey);
    const promptMap = prompts.get(idx) as Y.Map<unknown> | undefined;
    if (!promptMap) {
      logger.warn(`[yjs] sendText: no prompt at index ${idx}`);
      return;
    }

    const stream = promptMap.get("reply-to-stream") as Y.Text | undefined;
    if (!stream) {
      logger.warn(`[yjs] sendText: no reply-to-stream at index ${idx}`);
      return;
    }

    stream.insert(stream.length, text);
  }

  function completeResponse(sessionKey: string, text: string): void {
    const idx = Number(sessionKey);
    const promptMap = prompts.get(idx) as Y.Map<unknown> | undefined;
    if (!promptMap) {
      logger.warn(`[yjs] completeResponse: no prompt at index ${idx}`);
      return;
    }

    const arr = promptMap.get("reply-to-array") as Y.Array<string> | undefined;
    if (!arr) {
      logger.warn(
        `[yjs] completeResponse: no reply-to-array at index ${idx}`,
      );
      return;
    }

    arr.push([text]);
    setPresence("waiting");

    logger.info(
      `[yjs] Response complete [${idx}]: ${text.slice(0, 80)}`,
    );
  }

  return {
    id: "yjs",
    meta: {
      id: "yjs",
      label: "YJS",
      selectionLabel: "YJS (Collaborative)",
      blurb: "Yjs collaborative document channel",
      aliases: ["yjs"],
    },
    capabilities: {
      chatTypes: ["direct"],
    },
    config: {
      listAccountIds: () => ["default"],
      resolveAccount: () => ({}),
      defaultAccountId: () => "default",
      isConfigured: () => true,
      describeAccount: () => ({
        accountId: "default",
        name: botName,
        enabled: true,
        configured: true,
      }),
    },
    // Custom methods for YJS-specific functionality
    startObserving,
    sendText,
    completeResponse,
  };
}

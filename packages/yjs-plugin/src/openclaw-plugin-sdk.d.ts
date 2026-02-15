// Type declarations for openclaw/plugin-sdk
// This file provides minimal types for compilation - full types are available at runtime

declare module "openclaw/plugin-sdk" {
  export interface OpenClawPluginApi {
    config: any;
    pluginConfig: any;
    logger: {
      info: (message: string) => void;
      warn: (message: string) => void;
      error: (message: string) => void;
      debug: (message: string) => void;
    };
    runtime: {
      channel: {
        routing: {
          resolveAgentRoute: (opts: any) => any;
        };
        reply: {
          formatAgentEnvelope: (opts: any) => string;
          resolveEnvelopeFormatOptions: (cfg: any) => any;
          finalizeInboundContext: (ctx: any) => any;
          dispatchReplyWithBufferedBlockDispatcher: (opts: any) => Promise<void>;
        };
      };
    };
    registerChannel: (opts: { plugin: any }) => void;
    registerService: (service: {
      id: string;
      start: () => Promise<void>;
      stop: () => Promise<void>;
    }) => void;
  }

  export interface ReplyPayload {
    text?: string;
    [key: string]: any;
  }

  export function createReplyPrefixOptions(opts: {
    cfg: any;
    agentId: string;
    channel: string;
    accountId: string;
  }): any;
}

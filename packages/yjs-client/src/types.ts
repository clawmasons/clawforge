import type WebSocket from "ws";

export interface ClawforgeYjsClientOptions {
  /** WebSocket URL to connect to (e.g. ws://localhost:4444) */
  url: string;
  /** Optional auth token appended as ?token= query param */
  token?: string;
  /** WebSocket constructor — defaults to globalThis.WebSocket. Pass `ws` for Node.js. */
  WebSocket?: typeof globalThis.WebSocket | typeof WebSocket;
  /** Enable automatic reconnection on close/error. Default: false */
  reconnect?: boolean;
  /** Maximum reconnection attempts before giving up. Default: 10 */
  maxRetries?: number;
  /** Base backoff delay in ms (doubled each retry). Default: 1000 */
  backoff?: number;
}

export interface PermissionError {
  error: string;
  subspaces: string[];
}

export type ClawforgeYjsClientEvents = {
  synced: () => void;
  permissionError: (err: PermissionError) => void;
  awareness: (update: Uint8Array) => void;
  close: (code: number, reason: string) => void;
  error: (err: Event | Error) => void;
};

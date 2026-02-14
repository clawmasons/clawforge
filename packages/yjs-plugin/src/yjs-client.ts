import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import WebSocket from "ws";
import type { YjsPluginConfig } from "./types.js";

const MSG_SYNC = 0;

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export class YjsClient {
  readonly doc: Y.Doc;
  private ws: WebSocket | null = null;
  private config: YjsPluginConfig;
  private backoff = INITIAL_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  /** Resolves once the first sync handshake completes */
  readonly synced: Promise<void>;
  private resolveSynced!: () => void;
  private _isSynced = false;

  constructor(config: YjsPluginConfig) {
    this.config = config;
    this.doc = new Y.Doc();
    this.synced = new Promise((resolve) => {
      this.resolveSynced = resolve;
    });
  }

  get isSynced(): boolean {
    return this._isSynced;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private connect(): void {
    if (this.stopped) return;

    const url = this.config.token
      ? `${this.config.host}?token=${this.config.token}`
      : this.config.host;

    console.log(`[yjs-plugin] Connecting to ${this.config.host}...`);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.binaryType = "arraybuffer";

    ws.on("open", () => {
      console.log("[yjs-plugin] Connected to yjs-server");
      this.backoff = INITIAL_BACKOFF_MS;

      // Send sync step 1
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeSyncStep1(encoder, this.doc);
      ws.send(encoding.toUint8Array(encoder));
    });

    ws.on("message", (data: ArrayBuffer | Buffer) => {
      const message = new Uint8Array(data as ArrayBuffer);
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === MSG_SYNC) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        const syncMessageType = syncProtocol.readSyncMessage(
          decoder,
          encoder,
          this.doc,
          "remote",
        );

        // syncMessageType 1 = SyncStep2 (response to our SyncStep1) → initial sync done
        if (syncMessageType === 1 && !this._isSynced) {
          this._isSynced = true;
          console.log("[yjs-plugin] Initial sync complete");
          this.resolveSynced();
        }

        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder));
        }
      }
    });

    // Forward local doc updates to the server
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      // Don't echo back remote updates
      if (origin === "remote") return;
      if (ws.readyState !== WebSocket.OPEN) return;

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      ws.send(encoding.toUint8Array(encoder));
    };
    this.doc.on("update", onUpdate);

    ws.on("close", () => {
      console.log("[yjs-plugin] Disconnected from yjs-server");
      this.doc.off("update", onUpdate);
      this.ws = null;
      this.scheduleReconnect();
    });

    ws.on("error", (err) => {
      console.error("[yjs-plugin] WebSocket error:", err.message);
      // 'close' event will fire after this, triggering reconnect
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;

    console.log(
      `[yjs-plugin] Reconnecting in ${this.backoff}ms...`,
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoff);

    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
  }
}

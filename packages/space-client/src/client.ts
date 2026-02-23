import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import {
  MSG_SYNC,
  MSG_AWARENESS,
  MSG_SUBSPACE_SYNC,
  MSG_PERMISSION_ERROR,
} from "./protocol.js";
import type {
  ClawforgeYjsClientOptions,
  ClawforgeYjsClientEvents,
  PermissionError,
} from "./types.js";

type Listener<K extends keyof ClawforgeYjsClientEvents> = ClawforgeYjsClientEvents[K];

export class ClawforgeYjsClient {
  readonly doc: Y.Doc;
  readonly subspaces = new Map<string, Y.Doc>();

  /** Resolves when the root doc sync handshake completes. */
  readonly synced: Promise<void>;

  private ws: InstanceType<typeof globalThis.WebSocket> | null = null;
  private readonly url: string;
  private readonly token?: string;
  private readonly WsCtor: typeof globalThis.WebSocket;
  private readonly reconnectEnabled: boolean;
  private readonly maxRetries: number;
  private readonly backoff: number;
  private retryCount = 0;
  private closed = false;
  private rootSynced = false;
  private resolveSynced!: () => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly listeners = new Map<
    keyof ClawforgeYjsClientEvents,
    Set<Listener<keyof ClawforgeYjsClientEvents>>
  >();

  private readonly onRootUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === "remote") return;
    if (!this.ws || this.ws.readyState !== 1 /* OPEN */) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    this.ws.send(encoding.toUint8Array(encoder));
  };

  constructor(opts: ClawforgeYjsClientOptions) {
    this.url = opts.url;
    this.token = opts.token;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.WsCtor = (opts.WebSocket ?? globalThis.WebSocket) as any;
    this.reconnectEnabled = opts.reconnect ?? false;
    this.maxRetries = opts.maxRetries ?? 10;
    this.backoff = opts.backoff ?? 1000;

    this.doc = new Y.Doc();
    this.synced = new Promise<void>((resolve) => {
      this.resolveSynced = resolve;
    });
    this.doc.on("update", this.onRootUpdate);

    this.connect();
  }

  /** Subscribe to an event. */
  on<K extends keyof ClawforgeYjsClientEvents>(
    event: K,
    listener: ClawforgeYjsClientEvents[K],
  ): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<keyof ClawforgeYjsClientEvents>);
  }

  /** Unsubscribe from an event. */
  off<K extends keyof ClawforgeYjsClientEvents>(
    event: K,
    listener: ClawforgeYjsClientEvents[K],
  ): void {
    this.listeners.get(event)?.delete(listener as Listener<keyof ClawforgeYjsClientEvents>);
  }

  private emit<K extends keyof ClawforgeYjsClientEvents>(
    event: K,
    ...args: Parameters<ClawforgeYjsClientEvents[K]>
  ): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      (listener as (...a: unknown[]) => void)(...args);
    }
  }

  /**
   * Request sync for a subspace. Returns the local Y.Doc for it.
   * If already requested, returns the existing doc.
   */
  subspace(name: string): Y.Doc {
    let subdoc = this.subspaces.get(name);
    if (subdoc) return subdoc;

    subdoc = new Y.Doc();
    this.subspaces.set(name, subdoc);

    // Auto-forward local updates for this subspace
    subdoc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return;
      if (!this.ws || this.ws.readyState !== 1) return;
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_SUBSPACE_SYNC);
      encoding.writeVarString(enc, name);
      syncProtocol.writeUpdate(enc, update);
      this.ws.send(encoding.toUint8Array(enc));
    });

    // Send syncStep1 to request subspace data from server
    if (this.ws && this.ws.readyState === 1) {
      this.sendSubspaceStep1(name, subdoc);
    }

    return subdoc;
  }

  /** Send an awareness update to the server. */
  sendAwareness(update: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== 1) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(encoder, update);
    this.ws.send(encoding.toUint8Array(encoder));
  }

  /** Close the client and clean up all resources. */
  close(): void {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.doc.off("update", this.onRootUpdate);
    for (const subdoc of this.subspaces.values()) {
      subdoc.destroy();
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private connect(): void {
    const wsUrl = this.token
      ? `${this.url}?token=${encodeURIComponent(this.token)}`
      : this.url;

    this.ws = new this.WsCtor(wsUrl);
    // Set binaryType for environments that support it
    if ("binaryType" in this.ws) {
      (this.ws as { binaryType: string }).binaryType = "arraybuffer";
    }

    this.ws.onopen = () => {
      this.retryCount = 0;
      // Send root doc syncStep1
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeSyncStep1(encoder, this.doc);
      this.ws!.send(encoding.toUint8Array(encoder));
    };

    this.ws.onmessage = (event: MessageEvent | { data: unknown }) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = (event: { code: number; reason: string }) => {
      const code = event.code ?? 1006;
      const reason = String(event.reason ?? "");
      this.emit("close", code, reason);
      this.maybeReconnect();
    };

    this.ws.onerror = (err: Event | Error) => {
      this.emit("error", err);
    };
  }

  private handleMessage(data: unknown): void {
    // Normalize cross-environment message data
    let bytes: Uint8Array;
    if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      bytes = data;
    } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
      bytes = new Uint8Array(data);
    } else if (typeof Blob !== "undefined" && data instanceof Blob) {
      // Blob (browser) — async conversion
      data.arrayBuffer().then((buf) => {
        this.processMessage(new Uint8Array(buf));
      });
      return;
    } else {
      return;
    }
    this.processMessage(bytes);
  }

  private processMessage(message: Uint8Array): void {
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MSG_SYNC: {
        const responseEncoder = encoding.createEncoder();
        encoding.writeVarUint(responseEncoder, MSG_SYNC);
        const syncType = syncProtocol.readSyncMessage(
          decoder,
          responseEncoder,
          this.doc,
          "remote",
        );
        if (syncType === 1 && !this.rootSynced) {
          this.rootSynced = true;
          this.resolveSynced();
          this.emit("synced");
        }
        if (encoding.length(responseEncoder) > 1) {
          this.ws!.send(encoding.toUint8Array(responseEncoder));
        }
        break;
      }
      case MSG_AWARENESS: {
        const update = decoding.readVarUint8Array(decoder);
        this.emit("awareness", update);
        break;
      }
      case MSG_SUBSPACE_SYNC: {
        const subspaceName = decoding.readVarString(decoder);
        let isNew = false;
        let subdoc = this.subspaces.get(subspaceName);
        if (!subdoc) {
          // Server-initiated subspace — create local doc
          isNew = true;
          subdoc = new Y.Doc();
          this.subspaces.set(subspaceName, subdoc);
          // Auto-forward local updates for this subspace
          subdoc.on("update", (update: Uint8Array, origin: unknown) => {
            if (origin === "remote") return;
            if (!this.ws || this.ws.readyState !== 1) return;
            const enc = encoding.createEncoder();
            encoding.writeVarUint(enc, MSG_SUBSPACE_SYNC);
            encoding.writeVarString(enc, subspaceName);
            syncProtocol.writeUpdate(enc, update);
            this.ws.send(encoding.toUint8Array(enc));
          });
        }
        const responseEncoder = encoding.createEncoder();
        encoding.writeVarUint(responseEncoder, MSG_SUBSPACE_SYNC);
        encoding.writeVarString(responseEncoder, subspaceName);
        const beforeLen = encoding.length(responseEncoder);
        syncProtocol.readSyncMessage(
          decoder,
          responseEncoder,
          subdoc,
          "remote",
        );
        if (encoding.length(responseEncoder) > beforeLen) {
          this.ws!.send(encoding.toUint8Array(responseEncoder));
        }
        // On first contact with a server-initiated subspace, send step1
        if (isNew) {
          this.sendSubspaceStep1(subspaceName, subdoc);
        }
        break;
      }
      case MSG_PERMISSION_ERROR: {
        const payload = decoding.readVarString(decoder);
        const err: PermissionError = JSON.parse(payload);
        this.emit("permissionError", err);
        break;
      }
    }
  }

  private sendSubspaceStep1(name: string, subdoc: Y.Doc): void {
    if (!this.ws || this.ws.readyState !== 1) return;
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_SUBSPACE_SYNC);
    encoding.writeVarString(enc, name);
    syncProtocol.writeSyncStep1(enc, subdoc);
    this.ws.send(encoding.toUint8Array(enc));
  }

  private maybeReconnect(): void {
    if (this.closed || !this.reconnectEnabled) return;
    if (this.retryCount >= this.maxRetries) return;

    const delay = this.backoff * Math.pow(2, this.retryCount);
    this.retryCount++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();

      // After reconnect, re-sync root doc on open is handled by connect().
      // Re-sync all previously accessed subspaces once the ws is open.
      const ws = this.ws!;
      const originalOnOpen = ws.onopen;
      ws.onopen = (ev: Event) => {
        if (originalOnOpen) {
          (originalOnOpen as (ev: Event) => void).call(ws, ev);
        }
        // Re-sync all subspaces
        for (const [name, subdoc] of this.subspaces) {
          this.sendSubspaceStep1(name, subdoc);
        }
      };
    }, delay);
  }
}

import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import type { WebSocket } from "ws";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

const connections = new Set<WebSocket>();

export function setupYjsConnection(ws: WebSocket, doc: Y.Doc): void {
  connections.add(ws);

  // Send sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  ws.send(encoding.toUint8Array(encoder));

  // Listen for incoming messages
  ws.on("message", (data: ArrayBuffer | Buffer) => {
    const message = new Uint8Array(data as ArrayBuffer);
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MSG_SYNC: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, doc, null);
        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder));
        }
        break;
      }
      case MSG_AWARENESS: {
        // Relay raw awareness data to all other clients
        for (const conn of connections) {
          if (conn !== ws && conn.readyState === ws.OPEN) {
            conn.send(message);
          }
        }
        break;
      }
    }
  });

  // Broadcast doc updates to other clients
  const onUpdate = (update: Uint8Array, _origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const conn of connections) {
      if (conn !== ws && conn.readyState === ws.OPEN) {
        conn.send(message);
      }
    }
  };
  doc.on("update", onUpdate);

  ws.on("close", () => {
    connections.delete(ws);
    doc.off("update", onUpdate);
    console.log(`[sync] Client disconnected (${connections.size} remaining)`);
  });

  console.log(`[sync] Client connected (${connections.size} total)`);
}

import { createServer } from "node:http";
import { URL } from "node:url";
import * as Y from "yjs";
import { WebSocketServer } from "ws";
import { authenticateProgram } from "./auth.js";
import { FilePersistence } from "./persistence.js";
import { setupYjsConnection } from "./sync.js";
import {
  getSpaceAppTriggerMetadata,
  onAppTriggerEvent,
} from "./apps.js";

const CLAWFORGE_API_URL = process.env.CLAWFORGE_API_URL ?? "http://localhost:4000";
const CLAWFORGE_TOKEN = process.env.CLAWFORGE_TOKEN ?? "";
const PROGRAM_ID = process.env.PROGRAM_ID ?? "default";
const DATA_DIR = process.env.DATA_DIR ?? "/home/pn/data";
const PORT = parseInt(process.env.PORT ?? "1234", 10);

// Single shared document
const doc = new Y.Doc();

// File persistence
const dataFile = `${DATA_DIR}/program-data-${PROGRAM_ID}.yjs`;
const persistence = new FilePersistence(dataFile, doc);
persistence.load();

// HTTP server
const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("yjs-server ok\n");
});

// WebSocket server (noServer mode for auth)
const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", async (req, socket, head) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const token = url.searchParams.get("token") ?? "";
    const pathParts = url.pathname.split("/").filter(Boolean);
    const orgSlug = pathParts[0] ?? "org";
    const spaceSlug = pathParts[1] ?? "space";

    const authResult = await authenticateProgram(CLAWFORGE_API_URL, CLAWFORGE_TOKEN, token);
    const triggerBindings = await getSpaceAppTriggerMetadata(
      CLAWFORGE_API_URL,
      CLAWFORGE_TOKEN,
      orgSlug,
      spaceSlug,
    );

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, authResult.permissions, {
        orgSlug,
        spaceSlug,
        triggerBindings,
      });
    });
  } catch (err) {
    console.error("[server] Auth failed:", err);
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

wss.on(
  "connection",
  (
    ws,
    _req,
    permissions?: string[],
    triggerMeta?: {
      orgSlug: string;
      spaceSlug: string;
      triggerBindings: Awaited<ReturnType<typeof getSpaceAppTriggerMetadata>>;
    },
  ) => {
    setupYjsConnection(ws, doc, permissions, {
      triggerBindings: triggerMeta?.triggerBindings,
      onTrigger: async (payload) => {
        if (!triggerMeta) return;
        await onAppTriggerEvent({
          orgSlug: triggerMeta.orgSlug,
          spaceSlug: triggerMeta.spaceSlug,
          appSlug: payload.appSlug,
          event: payload.event,
          path: payload.path,
          changedPath: payload.changedPath,
        });
      },
    });
  },
);

// Graceful shutdown
function shutdown() {
  console.log("[server] Shutting down…");
  persistence.flush();
  wss.close();
  httpServer.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

httpServer.listen(PORT, () => {
  console.log(`[server] yjs-server listening on port ${PORT}`);
  console.log(`[server] Program: ${PROGRAM_ID}, data file: ${dataFile}`);
});

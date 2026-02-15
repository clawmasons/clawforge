import { createServer } from "node:http";
import { URL } from "node:url";
import * as Y from "yjs";
import { WebSocketServer } from "ws";
import { authenticateProgram } from "./auth.js";
import { FilePersistence } from "./persistence.js";
import { setupYjsConnection } from "./sync.js";

const CLAWFORGE_API_URL = process.env.CLAWFORGE_API_URL ?? "http://localhost:4000";
const CLAWFORGE_TOKEN = process.env.CLAWFORGE_TOKEN ?? "";
const PROGRAM_ID = process.env.PROGRAM_ID ?? "default";
const DATA_DIR = process.env.DATA_DIR ?? "/home/pn/data";
const PORT = parseInt(process.env.PORT ?? "1234", 10);

// Single shared document
const doc = new Y.Doc();

// File persistence
const dataFile = `${WORKSPACE_DIR}/program-data-${PROGRAM_ID}.yjs`;
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

    await authenticateProgram(CLAWFORGE_API_URL, CLAWFORGE_TOKEN, token);

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } catch (err) {
    console.error("[server] Auth failed:", err);
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

wss.on("connection", (ws) => {
  setupYjsConnection(ws, doc);
});

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

import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { runtimeService, type RuntimeIngestPayload } from "../runtimeService";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function registerRuntimeRoutes(app: express.Express) {
  app.get("/api/runtime/stream", async (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const snapshots = await runtimeService.loadPersistedSessions();
    if (snapshots.length === 0) {
      await runtimeService.seedDemoSession();
    }

    res.write(`event: bootstrap\n`);
    res.write(`data: ${JSON.stringify(runtimeService.getSnapshots())}\n\n`);

    const unsubscribe = runtimeService.subscribe(event => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
    });

    _req.on("close", () => {
      unsubscribe();
      res.end();
    });
  });

  app.post("/api/runtime/ingest", async (req, res) => {
    try {
      const payload = req.body as RuntimeIngestPayload;
      const snapshot = await runtimeService.ingest(payload);
      res.json({ success: true, snapshot });
    } catch (error) {
      console.error("[Runtime] Failed to ingest payload", error);
      res.status(500).json({ success: false, error: "Failed to ingest runtime payload." });
    }
  });
}

function startNamedPipeBridge() {
  const pipePath = process.env.AICONTRADEF_PIPE_PATH;
  if (!pipePath || process.platform !== "win32") {
    return;
  }

  const bridge = net.createServer(socket => {
    let buffer = "";

    socket.on("data", async chunk => {
      buffer += chunk.toString();
      const messages = buffer.split("\n");
      buffer = messages.pop() ?? "";

      for (const rawMessage of messages) {
        const trimmed = rawMessage.trim();
        if (!trimmed) continue;

        try {
          const payload = JSON.parse(trimmed) as RuntimeIngestPayload;
          await runtimeService.ingest(payload);
        } catch (error) {
          console.warn("[NamedPipeBridge] Invalid message received", error);
        }
      }
    });
  });

  bridge.listen(pipePath, () => {
    console.log(`[NamedPipeBridge] Listening on ${pipePath}`);
  });
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);
  registerRuntimeRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  await runtimeService.loadPersistedSessions();
  void runtimeService.seedDemoSession();
  startNamedPipeBridge();

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);

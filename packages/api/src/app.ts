import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  fastifyTRPCPlugin,
  FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { appRouter, type AppRouter } from "./router.js";
import { createContext } from "./trpc.js";
import { auth } from "./auth.js";
import { botRoutes } from "./routes/bot.js";

export async function createApp() {
  const server = Fastify({ logger: true });

  // CORS
  await server.register(cors, {
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  });

  // Health check
  server.get("/health", async () => ({ status: "ok", service: "api" }));

  // Better Auth catch-all
  server.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(
        request.url,
        `${request.protocol}://${request.hostname}`,
      );
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value)
          headers.append(
            key,
            Array.isArray(value) ? value.join(", ") : value,
          );
      }

      const webRequest = new Request(url.toString(), {
        method: request.method,
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
      });

      const response = await auth.handler(webRequest);

      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));

      const text = await response.text();
      reply.send(text || null);
    },
  });

  // tRPC
  await server.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: ({ req }) => createContext(req),
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  // Bot REST routes (token-authenticated)
  await server.register(botRoutes);

  return server;
}

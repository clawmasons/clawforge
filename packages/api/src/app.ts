import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  fastifyTRPCPlugin,
  FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { appRouter, type AppRouter } from "./router.js";

export async function createApp() {
  const server = Fastify({ logger: true });

  // CORS
  // todo: SECURITY lock down cors for production
  await server.register(cors, { origin: true });

  // Health check
  server.get("/health", async () => ({ status: "ok", service: "api" }));

  // tRPC
  await server.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  return server;
}

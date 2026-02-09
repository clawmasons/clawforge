import Fastify from "fastify";
import {
  fastifyTRPCPlugin,
  FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { appRouter, type AppRouter } from "./router.js";

const server = Fastify({ logger: true });

// Health check
server.get("/health", async () => ({ status: "ok", service: "api" }));

// tRPC
server.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
  } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
});

const start = async () => {
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";

  await server.listen({ port, host });
  console.log(`API server listening on ${host}:${port}`);
};

start().catch((err) => {
  server.log.error(err);
  process.exit(1);
});

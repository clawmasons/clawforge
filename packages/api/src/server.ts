import { createApp } from "./app.js";

const start = async () => {
  const server = await createApp();
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";

  await server.listen({ port, host });
  console.log(`API server listening on ${host}:${port}`);
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

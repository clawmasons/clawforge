import { initTRPC, TRPCError } from "@trpc/server";
import type { FastifyRequest } from "fastify";
import { auth } from "./auth.js";

export async function createContext(req: FastifyRequest) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value)
      headers.append(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const session = await auth.api.getSession({ headers });
  return { session: session?.session ?? null, user: session?.user ?? null };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { session: ctx.session, user: ctx.user } });
});

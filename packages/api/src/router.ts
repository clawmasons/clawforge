import { z } from "zod";
import { router, publicProcedure } from "./trpc.js";
import { db } from "./db/index.js";
import { organizations } from "./db/schema.js";

export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }).optional())
    .query(({ input }) => {
      return { greeting: `Hello, ${input?.name ?? "world"}!` };
    }),

  organizations: router({
    list: publicProcedure.query(async () => {
      return db.select().from(organizations);
    }),
  }),
});

export type AppRouter = typeof appRouter;

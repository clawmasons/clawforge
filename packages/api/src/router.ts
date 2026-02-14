import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "./trpc.js";
import { db } from "./db/index.js";
import { organization, member, user, program } from "./db/schema.js";

export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }).optional())
    .query(({ input }) => {
      return { greeting: `Hello, ${input?.name ?? "world"}!` };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  organizations: router({
    list: publicProcedure.query(async () => {
      return db.select().from(organization);
    }),

    myOrganizations: protectedProcedure.query(async ({ ctx }) => {
      return db
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          logo: organization.logo,
        })
        .from(member)
        .innerJoin(organization, eq(member.organizationId, organization.id))
        .where(eq(member.userId, ctx.user.id));
    }),

    members: protectedProcedure
      .input(z.object({ organizationId: z.string() }))
      .query(async ({ ctx, input }) => {
        // Verify caller is a member of the organization
        const callerMembership = await db
          .select()
          .from(member)
          .where(
            and(
              eq(member.organizationId, input.organizationId),
              eq(member.userId, ctx.user.id),
            ),
          )
          .then((rows) => rows[0]);

        if (!callerMembership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not a member of this organization.",
          });
        }

        return db
          .select({
            id: member.id,
            role: member.role,
            createdAt: member.createdAt,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            userImage: user.image,
          })
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(eq(member.organizationId, input.organizationId));
      }),

    programs: protectedProcedure
      .input(z.object({ organizationId: z.string() }))
      .query(async ({ ctx, input }) => {
        // Verify caller is a member of the organization
        const callerMembership = await db
          .select()
          .from(member)
          .where(
            and(
              eq(member.organizationId, input.organizationId),
              eq(member.userId, ctx.user.id),
            ),
          )
          .then((rows) => rows[0]);

        if (!callerMembership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not a member of this organization.",
          });
        }

        return db
          .select({
            id: program.id,
            programId: program.programId,
            launchedBy: program.launchedBy,
            createdAt: program.createdAt,
          })
          .from(program)
          .where(eq(program.organizationId, input.organizationId));
      }),
  }),

  programs: router({
    launch: protectedProcedure
      .input(z.object({ programId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.session.activeOrganizationId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No active organization. Please select an organization first.",
          });
        }

        // Check if program already exists
        const existing = await db
          .select()
          .from(program)
          .where(eq(program.programId, input.programId))
          .then((rows) => rows[0]);

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This program has already been launched.",
          });
        }

        const id = randomUUID();
        await db.insert(program).values({
          id,
          programId: input.programId,
          organizationId: ctx.session.activeOrganizationId,
          launchedBy: ctx.user.id,
          createdAt: new Date(),
        });

        return { success: true, programId: id };
      }),

    join: protectedProcedure
      .input(z.object({ programId: z.string() }))
      .mutation(async () => {
        throw new TRPCError({
          code: "METHOD_NOT_SUPPORTED",
          message: "Join is not yet implemented.",
        });
      }),

    listLaunched: publicProcedure.query(async () => {
      const rows = await db
        .select({ programId: program.programId })
        .from(program);

      return rows.map((r) => r.programId);
    }),

    myMemberships: protectedProcedure.query(async ({ ctx }) => {
      const rows = await db
        .select({
          programId: program.programId,
          role: member.role,
        })
        .from(program)
        .innerJoin(member, eq(program.organizationId, member.organizationId))
        .where(eq(member.userId, ctx.user.id));

      return rows as { programId: string; role: string }[];
    }),
  }),
});

export type AppRouter = typeof appRouter;

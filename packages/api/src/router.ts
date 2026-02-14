import { z } from "zod";
import { eq, and, isNotNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "./trpc.js";
import { db } from "./db/index.js";
import { organization, member, user } from "./db/schema.js";
import { auth } from "./auth.js";

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
  }),

  programs: router({
    launch: protectedProcedure
      .input(z.object({ programId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Check if an org already exists for this program
        const existing = await db
          .select()
          .from(organization)
          .where(eq(organization.programId, input.programId))
          .then((rows) => rows[0]);

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This program has already been launched.",
          });
        }

        // Create org via Better Auth (user becomes owner)
        const slug = `program-${input.programId}`;
        const org = await auth.api.createOrganization({
          body: {
            name: input.programId,
            slug,
            userId: ctx.user.id,
          },
        });

        if (!org) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create organization.",
          });
        }

        // Set programId on the new org
        await db
          .update(organization)
          .set({ programId: input.programId })
          .where(eq(organization.id, org.id));

        return { success: true, organizationId: org.id };
      }),

    join: protectedProcedure
      .input(z.object({ programId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Find org for this program
        const org = await db
          .select()
          .from(organization)
          .where(eq(organization.programId, input.programId))
          .then((rows) => rows[0]);

        if (!org) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "This program has not been launched yet.",
          });
        }

        // Check if user is already a member
        const existingMembership = await db
          .select()
          .from(member)
          .where(
            and(
              eq(member.organizationId, org.id),
              eq(member.userId, ctx.user.id),
            ),
          )
          .then((rows) => rows[0]);

        if (existingMembership) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You are already a member of this program.",
          });
        }

        // Direct DB insert (Better Auth's addMember requires caller to be admin/owner)
        await db.insert(member).values({
          id: randomUUID(),
          organizationId: org.id,
          userId: ctx.user.id,
          role: "member",
          createdAt: new Date(),
        });

        return { success: true, organizationId: org.id };
      }),

    listLaunched: publicProcedure.query(async () => {
      const orgs = await db
        .select({ programId: organization.programId })
        .from(organization)
        .where(isNotNull(organization.programId));

      return orgs.map((o) => o.programId as string);
    }),

    myMemberships: protectedProcedure.query(async ({ ctx }) => {
      const memberships = await db
        .select({
          programId: organization.programId,
          role: member.role,
        })
        .from(member)
        .innerJoin(organization, eq(member.organizationId, organization.id))
        .where(eq(member.userId, ctx.user.id));

      return memberships.filter((m) => m.programId !== null) as {
        programId: string;
        role: string;
      }[];
    }),
  }),
});

export type AppRouter = typeof appRouter;

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "./trpc.js";
import { db } from "./db/index.js";
import { organization, member, user, program, orgApiToken, bot } from "./db/schema.js";
import { generateApiToken } from "./lib/token.js";

async function verifyOrgOwner(userId: string, orgId: string) {
  const row = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
    .then((rows) => rows[0]);

  if (!row || row.role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only organization owners can manage API tokens.",
    });
  }
}

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

    tokens: router({
      list: protectedProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
          await verifyOrgOwner(ctx.user.id, input.organizationId);

          return db
            .select({
              id: orgApiToken.id,
              label: orgApiToken.label,
              tokenPrefix: orgApiToken.tokenPrefix,
              enabled: orgApiToken.enabled,
              createdAt: orgApiToken.createdAt,
              lastUsedAt: orgApiToken.lastUsedAt,
            })
            .from(orgApiToken)
            .where(eq(orgApiToken.organizationId, input.organizationId));
        }),

      create: protectedProcedure
        .input(z.object({ organizationId: z.string(), label: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
          await verifyOrgOwner(ctx.user.id, input.organizationId);

          const { raw, hash, prefix } = generateApiToken();
          const id = randomUUID();

          await db.insert(orgApiToken).values({
            id,
            organizationId: input.organizationId,
            label: input.label,
            tokenHash: hash,
            tokenPrefix: prefix,
            createdBy: ctx.user.id,
          });

          return { id, label: input.label, tokenPrefix: prefix, token: raw };
        }),

      toggleEnabled: protectedProcedure
        .input(
          z.object({
            organizationId: z.string(),
            tokenId: z.string(),
            enabled: z.boolean(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          await verifyOrgOwner(ctx.user.id, input.organizationId);

          const existing = await db
            .select({ id: orgApiToken.id })
            .from(orgApiToken)
            .where(
              and(
                eq(orgApiToken.id, input.tokenId),
                eq(orgApiToken.organizationId, input.organizationId),
              ),
            )
            .then((rows) => rows[0]);

          if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Token not found." });
          }

          await db
            .update(orgApiToken)
            .set({ enabled: input.enabled })
            .where(eq(orgApiToken.id, input.tokenId));

          return { ok: true };
        }),

      delete: protectedProcedure
        .input(z.object({ organizationId: z.string(), tokenId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          await verifyOrgOwner(ctx.user.id, input.organizationId);

          const existing = await db
            .select({ id: orgApiToken.id })
            .from(orgApiToken)
            .where(
              and(
                eq(orgApiToken.id, input.tokenId),
                eq(orgApiToken.organizationId, input.organizationId),
              ),
            )
            .then((rows) => rows[0]);

          if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Token not found." });
          }

          await db.delete(orgApiToken).where(eq(orgApiToken.id, input.tokenId));

          return { ok: true };
        }),
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

    details: protectedProcedure
      .input(z.object({ programId: z.string() }))
      .query(async ({ ctx, input }) => {
        // Look up program by slug
        const prog = await db
          .select()
          .from(program)
          .where(eq(program.programId, input.programId))
          .then((rows) => rows[0]);

        if (!prog) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Program not found.",
          });
        }

        // Verify caller is a member of the program's org
        const callerMembership = await db
          .select()
          .from(member)
          .where(
            and(
              eq(member.organizationId, prog.organizationId),
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

        // Get launcher info
        const launcher = await db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          })
          .from(user)
          .where(eq(user.id, prog.launchedBy))
          .then((rows) => rows[0]);

        // Get bots currently in this program
        const bots = await db
          .select({
            id: bot.id,
            name: bot.name,
            currentRole: bot.currentRole,
            status: bot.status,
            ownerId: user.id,
            ownerName: user.name,
            ownerEmail: user.email,
            ownerImage: user.image,
          })
          .from(bot)
          .innerJoin(user, eq(bot.ownerId, user.id))
          .where(eq(bot.currentProgramId, prog.id));

        return {
          id: prog.id,
          programId: prog.programId,
          organizationId: prog.organizationId,
          launchedBy: launcher!,
          createdAt: prog.createdAt,
          bots: bots.map((b) => ({
            id: b.id,
            name: b.name,
            currentRole: b.currentRole,
            status: b.status,
            owner: {
              id: b.ownerId,
              name: b.ownerName,
              email: b.ownerEmail,
              image: b.ownerImage,
            },
          })),
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;

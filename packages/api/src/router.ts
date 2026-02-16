import { z } from "zod";
import { eq, and, count, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "./trpc.js";
import { db } from "./db/index.js";
import { organization, member, user, space, spaceMember, spaceTask, orgApiToken, bot } from "./db/schema.js";
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

async function verifyOrgAdmin(userId: string, orgId: string) {
  const row = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
    .then((rows) => rows[0]);

  if (!row || !["owner", "admin"].includes(row.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only organization admins and owners can perform this action.",
    });
  }
}

async function verifyOrgMember(userId: string, orgId: string) {
  const row = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
    .then((rows) => rows[0]);

  if (!row) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this organization.",
    });
  }
}

function generateSpaceId(): string {
  return `space-${randomUUID().slice(0, 8)}`;
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
        await verifyOrgMember(ctx.user.id, input.organizationId);

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

  spaces: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.session.activeOrganizationId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active organization set.",
        });
      }

      await verifyOrgMember(ctx.user.id, ctx.session.activeOrganizationId);

      const taskCountSubquery = db
        .select({
          spaceId: spaceTask.spaceId,
          taskCount: count().as("task_count"),
        })
        .from(spaceTask)
        .groupBy(spaceTask.spaceId)
        .as("task_counts");

      const rows = await db
        .select({
          id: space.id,
          name: space.name,
          description: space.description,
          spaceId: space.spaceId,
          createdBy: space.createdBy,
          createdAt: space.createdAt,
          updatedAt: space.updatedAt,
          taskCount: sql<number>`coalesce(${taskCountSubquery.taskCount}, 0)`.mapWith(Number),
        })
        .from(space)
        .leftJoin(taskCountSubquery, eq(space.id, taskCountSubquery.spaceId))
        .where(eq(space.organizationId, ctx.session.activeOrganizationId))
        .orderBy(sql`${space.createdAt} desc`);

      return rows;
    }),

    get: protectedProcedure
      .input(z.object({ spaceId: z.string() }))
      .query(async ({ ctx, input }) => {
        const spaceRow = await db
          .select()
          .from(space)
          .where(eq(space.id, input.spaceId))
          .then((rows) => rows[0]);

        if (!spaceRow) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Space not found." });
        }

        await verifyOrgMember(ctx.user.id, spaceRow.organizationId);

        const creator = await db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          })
          .from(user)
          .where(eq(user.id, spaceRow.createdBy))
          .then((rows) => rows[0]);

        const tasks = await db
          .select({
            id: spaceTask.id,
            name: spaceTask.name,
            botId: spaceTask.botId,
            botName: bot.name,
            role: spaceTask.role,
            state: spaceTask.state,
            createdAt: spaceTask.createdAt,
          })
          .from(spaceTask)
          .leftJoin(bot, eq(spaceTask.botId, bot.id))
          .where(eq(spaceTask.spaceId, input.spaceId))
          .orderBy(sql`${spaceTask.createdAt} desc`);

        return {
          id: spaceRow.id,
          name: spaceRow.name,
          description: spaceRow.description,
          spaceId: spaceRow.spaceId,
          organizationId: spaceRow.organizationId,
          createdBy: creator!,
          createdAt: spaceRow.createdAt,
          updatedAt: spaceRow.updatedAt,
          tasks,
        };
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          description: z.string().max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.session.activeOrganizationId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No active organization set.",
          });
        }

        await verifyOrgAdmin(ctx.user.id, ctx.session.activeOrganizationId);

        // Check name uniqueness within org
        const existing = await db
          .select({ id: space.id })
          .from(space)
          .where(
            and(
              eq(space.organizationId, ctx.session.activeOrganizationId),
              eq(space.name, input.name),
            ),
          )
          .then((rows) => rows[0]);

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A space with this name already exists in your organization.",
          });
        }

        const id = randomUUID();
        const spaceId = generateSpaceId();

        await db.insert(space).values({
          id,
          name: input.name,
          spaceId,
          description: input.description ?? null,
          organizationId: ctx.session.activeOrganizationId,
          createdBy: ctx.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        return { id, name: input.name, spaceId };
      }),

    update: protectedProcedure
      .input(
        z.object({
          spaceId: z.string(),
          name: z.string().min(1).max(100).optional(),
          description: z.string().max(500).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const spaceRow = await db
          .select()
          .from(space)
          .where(eq(space.id, input.spaceId))
          .then((rows) => rows[0]);

        if (!spaceRow) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Space not found." });
        }

        await verifyOrgMember(ctx.user.id, spaceRow.organizationId);

        // Check name uniqueness if name is being changed
        if (input.name && input.name !== spaceRow.name) {
          const existing = await db
            .select({ id: space.id })
            .from(space)
            .where(
              and(
                eq(space.organizationId, spaceRow.organizationId),
                eq(space.name, input.name),
              ),
            )
            .then((rows) => rows[0]);

          if (existing) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "A space with this name already exists in your organization.",
            });
          }
        }

        const updates: Record<string, unknown> = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.description !== undefined) updates.description = input.description;

        if (Object.keys(updates).length === 0) {
          return {
            id: spaceRow.id,
            name: spaceRow.name,
            description: spaceRow.description,
            updatedAt: spaceRow.updatedAt,
          };
        }

        await db.update(space).set(updates).where(eq(space.id, input.spaceId));

        const updated = await db
          .select({
            id: space.id,
            name: space.name,
            description: space.description,
            updatedAt: space.updatedAt,
          })
          .from(space)
          .where(eq(space.id, input.spaceId))
          .then((rows) => rows[0]);

        return updated!;
      }),

    delete: protectedProcedure
      .input(z.object({ spaceId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const spaceRow = await db
          .select()
          .from(space)
          .where(eq(space.id, input.spaceId))
          .then((rows) => rows[0]);

        if (!spaceRow) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Space not found." });
        }

        await verifyOrgAdmin(ctx.user.id, spaceRow.organizationId);

        await db.delete(space).where(eq(space.id, input.spaceId));

        return { ok: true as const };
      }),

    tasks: router({
      list: protectedProcedure
        .input(z.object({ spaceId: z.string() }))
        .query(async ({ ctx, input }) => {
          const spaceRow = await db
            .select({ organizationId: space.organizationId })
            .from(space)
            .where(eq(space.id, input.spaceId))
            .then((rows) => rows[0]);

          if (!spaceRow) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Space not found." });
          }

          await verifyOrgMember(ctx.user.id, spaceRow.organizationId);

          const rows = await db
            .select({
              id: spaceTask.id,
              name: spaceTask.name,
              botId: spaceTask.botId,
              botName: bot.name,
              role: spaceTask.role,
              triggers: spaceTask.triggers,
              state: spaceTask.state,
              createdAt: spaceTask.createdAt,
              updatedAt: spaceTask.updatedAt,
            })
            .from(spaceTask)
            .leftJoin(bot, eq(spaceTask.botId, bot.id))
            .where(eq(spaceTask.spaceId, input.spaceId))
            .orderBy(sql`${spaceTask.createdAt} desc`);

          return rows.map((r) => ({
            ...r,
            triggers: JSON.parse(r.triggers) as string[],
          }));
        }),

      get: protectedProcedure
        .input(z.object({ taskId: z.string() }))
        .query(async ({ ctx, input }) => {
          const taskRow = await db
            .select()
            .from(spaceTask)
            .where(eq(spaceTask.id, input.taskId))
            .then((rows) => rows[0]);

          if (!taskRow) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
          }

          const spaceRow = await db
            .select({ organizationId: space.organizationId })
            .from(space)
            .where(eq(space.id, taskRow.spaceId))
            .then((rows) => rows[0]);

          if (!spaceRow) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Space not found." });
          }

          await verifyOrgMember(ctx.user.id, spaceRow.organizationId);

          let botInfo: { id: string; name: string; status: string } | null = null;
          if (taskRow.botId) {
            const botRow = await db
              .select({ id: bot.id, name: bot.name, status: bot.status })
              .from(bot)
              .where(eq(bot.id, taskRow.botId))
              .then((rows) => rows[0]);
            botInfo = botRow ?? null;
          }

          const creator = await db
            .select({ id: user.id, name: user.name })
            .from(user)
            .where(eq(user.id, taskRow.createdBy))
            .then((rows) => rows[0]);

          return {
            id: taskRow.id,
            name: taskRow.name,
            spaceId: taskRow.spaceId,
            bot: botInfo,
            role: taskRow.role,
            triggers: JSON.parse(taskRow.triggers) as string[],
            schedule: taskRow.schedule,
            plan: taskRow.plan,
            state: taskRow.state,
            triggeredAt: taskRow.triggeredAt,
            startedAt: taskRow.startedAt,
            completedAt: taskRow.completedAt,
            createdBy: creator!,
            createdAt: taskRow.createdAt,
            updatedAt: taskRow.updatedAt,
          };
        }),

      create: protectedProcedure
        .input(
          z.object({
            spaceId: z.string(),
            name: z.string().min(1).max(100),
            botId: z.string(),
            role: z.string().min(1).max(100),
            triggers: z.array(z.string().min(1)).min(1),
            plan: z.string().min(1),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          const spaceRow = await db
            .select({ organizationId: space.organizationId })
            .from(space)
            .where(eq(space.id, input.spaceId))
            .then((rows) => rows[0]);

          if (!spaceRow) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Space not found." });
          }

          await verifyOrgAdmin(ctx.user.id, spaceRow.organizationId);

          // Validate bot belongs to same org
          const botRow = await db
            .select({ id: bot.id, organizationId: bot.organizationId })
            .from(bot)
            .where(eq(bot.id, input.botId))
            .then((rows) => rows[0]);

          if (!botRow || botRow.organizationId !== spaceRow.organizationId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Bot not found or does not belong to this organization.",
            });
          }

          // Validate unique task name within space
          const existing = await db
            .select({ id: spaceTask.id })
            .from(spaceTask)
            .where(
              and(
                eq(spaceTask.spaceId, input.spaceId),
                eq(spaceTask.name, input.name),
              ),
            )
            .then((rows) => rows[0]);

          if (existing) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "A task with this name already exists in this space.",
            });
          }

          const id = randomUUID();

          await db.insert(spaceTask).values({
            id,
            name: input.name,
            spaceId: input.spaceId,
            botId: input.botId,
            role: input.role,
            triggers: JSON.stringify(input.triggers),
            plan: input.plan,
            state: "idle",
            createdBy: ctx.user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          return { id, name: input.name };
        }),

      update: protectedProcedure
        .input(
          z.object({
            taskId: z.string(),
            name: z.string().min(1).max(100).optional(),
            botId: z.string().nullable().optional(),
            role: z.string().min(1).max(100).optional(),
            triggers: z.array(z.string().min(1)).min(1).optional(),
            plan: z.string().min(1).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          const taskRow = await db
            .select()
            .from(spaceTask)
            .where(eq(spaceTask.id, input.taskId))
            .then((rows) => rows[0]);

          if (!taskRow) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
          }

          const spaceRow = await db
            .select({ organizationId: space.organizationId })
            .from(space)
            .where(eq(space.id, taskRow.spaceId))
            .then((rows) => rows[0]);

          if (!spaceRow) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Space not found." });
          }

          await verifyOrgMember(ctx.user.id, spaceRow.organizationId);

          // Validate bot if changing
          if (input.botId !== undefined && input.botId !== null) {
            const botRow = await db
              .select({ id: bot.id, organizationId: bot.organizationId })
              .from(bot)
              .where(eq(bot.id, input.botId))
              .then((rows) => rows[0]);

            if (!botRow || botRow.organizationId !== spaceRow.organizationId) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Bot not found or does not belong to this organization.",
              });
            }
          }

          // Validate name uniqueness if changing
          if (input.name && input.name !== taskRow.name) {
            const existing = await db
              .select({ id: spaceTask.id })
              .from(spaceTask)
              .where(
                and(
                  eq(spaceTask.spaceId, taskRow.spaceId),
                  eq(spaceTask.name, input.name),
                ),
              )
              .then((rows) => rows[0]);

            if (existing) {
              throw new TRPCError({
                code: "CONFLICT",
                message: "A task with this name already exists in this space.",
              });
            }
          }

          const updates: Record<string, unknown> = {};
          if (input.name !== undefined) updates.name = input.name;
          if (input.botId !== undefined) updates.botId = input.botId;
          if (input.role !== undefined) updates.role = input.role;
          if (input.triggers !== undefined) updates.triggers = JSON.stringify(input.triggers);
          if (input.plan !== undefined) updates.plan = input.plan;

          if (Object.keys(updates).length === 0) {
            return { id: taskRow.id, name: taskRow.name, updatedAt: taskRow.updatedAt };
          }

          await db.update(spaceTask).set(updates).where(eq(spaceTask.id, input.taskId));

          const updated = await db
            .select({ id: spaceTask.id, name: spaceTask.name, updatedAt: spaceTask.updatedAt })
            .from(spaceTask)
            .where(eq(spaceTask.id, input.taskId))
            .then((rows) => rows[0]);

          return updated!;
        }),

      delete: protectedProcedure
        .input(z.object({ taskId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const taskRow = await db
            .select({ spaceId: spaceTask.spaceId })
            .from(spaceTask)
            .where(eq(spaceTask.id, input.taskId))
            .then((rows) => rows[0]);

          if (!taskRow) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
          }

          const spaceRow = await db
            .select({ organizationId: space.organizationId })
            .from(space)
            .where(eq(space.id, taskRow.spaceId))
            .then((rows) => rows[0]);

          if (!spaceRow) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Space not found." });
          }

          await verifyOrgAdmin(ctx.user.id, spaceRow.organizationId);

          await db.delete(spaceTask).where(eq(spaceTask.id, input.taskId));

          return { ok: true as const };
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;

import { z } from "zod";
import { eq, and, count, sql, inArray, lt } from "drizzle-orm";
import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "./trpc.js";
import { db } from "./db/index.js";
import {
  organization,
  member,
  user,
  space,
  spaceMember,
  spaceTask,
  orgApiToken,
  bot,
  invitation,
  app,
  spaceApp,
} from "./db/schema.js";
import { generateApiToken } from "./lib/token.js";
import { auth } from "./auth.js";

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

async function verifySpaceAdmin(userId: string, spaceId: string) {
  const spaceRow = await db
    .select({ organizationId: space.organizationId })
    .from(space)
    .where(eq(space.id, spaceId))
    .then((rows) => rows[0]);

  if (!spaceRow) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Space not found." });
  }

  // Check if user is an org admin/owner (implicit access to all spaces)
  const orgMemberRow = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, spaceRow.organizationId)))
    .then((rows) => rows[0]);

  if (orgMemberRow && ["owner", "admin"].includes(orgMemberRow.role)) {
    return { orgRole: orgMemberRow.role, spaceRole: null as string | null, organizationId: spaceRow.organizationId };
  }

  // Check space-level role
  const spaceMemberRow = await db
    .select({ role: spaceMember.role })
    .from(spaceMember)
    .where(and(eq(spaceMember.userId, userId), eq(spaceMember.spaceId, spaceId)))
    .then((rows) => rows[0]);

  if (!spaceMemberRow || !["owner", "admin"].includes(spaceMemberRow.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only space admins and owners can perform this action." });
  }

  return { orgRole: orgMemberRow?.role ?? null, spaceRole: spaceMemberRow.role, organizationId: spaceRow.organizationId };
}

function generateSpaceId(): string {
  return `space-${randomUUID().slice(0, 8)}`;
}

type AppDefinition = {
  setup: string;
  role_definitions?: string;
  tasks?: string;
};

type TaskTrigger = {
  event: string;
  path: string;
};

type AppTaskDefinition = {
  name?: string;
  enabled?: boolean;
  owner?: string | null;
  role?: string;
  requiredRoles?: string[];
  triggerEvents?: TaskTrigger[];
};

const DEFAULT_APP_SEEDS: Array<{
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  navigation: string[];
  subspacePath: string;
  appDefinition: AppDefinition;
  taskDefinitions: AppTaskDefinition[];
}> = [
  {
    slug: "chat",
    name: "Chat",
    description: "Collaborative chat for a space.",
    enabled: true,
    navigation: ["chats"],
    subspacePath: "private.chat",
    appDefinition: {
      role_definitions:
        "Define conversation owners and moderators for this space app.",
      tasks:
        "Create moderation and summarization tasks for active chat channels.",
      setup:
        "Create default chat tasks for this space: moderation watcher and daily summary. Use required roles in taskDefinitions and generate task plan text from this prompt.",
    },
    taskDefinitions: [
      {
        name: "chat-daily-summary",
        enabled: true,
        requiredRoles: ["member"],
        triggerEvents: [{ event: "memory-update", path: "chats" }],
      },
    ],
  },
  {
    slug: "coding-agent",
    name: "Coding Agent",
    description: "Applies software changes for the space repository workflows.",
    enabled: true,
    navigation: ["memory/view", "memory-edit"],
    subspacePath: "private.coding-agent",
    appDefinition: {
      role_definitions:
        "Define reviewer and approver roles for code change execution.",
      tasks:
        "Create implementation, review, and validation tasks tied to repository activity.",
      setup:
        "Create default coding-agent tasks for this space: implementation planning and validation. Ensure tasks include trigger bindings and required roles.",
    },
    taskDefinitions: [
      {
        name: "coding-agent-plan",
        enabled: true,
        requiredRoles: ["admin", "owner"],
        triggerEvents: [{ event: "memory-update", path: "memory" }],
      },
    ],
  },
];

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function ensureSeedAppsForOrg(organizationId: string) {
  for (const seed of DEFAULT_APP_SEEDS) {
    const existing = await db
      .select({ id: app.id })
      .from(app)
      .where(
        and(eq(app.organizationId, organizationId), eq(app.slug, seed.slug)),
      )
      .then((rows) => rows[0]);

    if (existing) continue;

    await db.insert(app).values({
      id: randomUUID(),
      organizationId,
      name: seed.name,
      slug: seed.slug,
      description: seed.description,
      enabled: seed.enabled,
      navigation: JSON.stringify(seed.navigation),
      subspacePath: seed.subspacePath,
      appDefinition: JSON.stringify(seed.appDefinition),
      taskDefinitions: JSON.stringify(seed.taskDefinitions),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

async function resolveTaskOwner(
  spaceId: string,
  explicitOwner: string | null | undefined,
  requiredRoles: string[],
) {
  if (explicitOwner) {
    const explicitMember = await db
      .select({ userId: spaceMember.userId })
      .from(spaceMember)
      .where(
        and(eq(spaceMember.spaceId, spaceId), eq(spaceMember.userId, explicitOwner)),
      )
      .then((rows) => rows[0]);
    if (explicitMember) return explicitMember.userId;
  }

  const members = await db
    .select({ userId: spaceMember.userId, role: spaceMember.role })
    .from(spaceMember)
    .where(eq(spaceMember.spaceId, spaceId))
    .orderBy(
      sql`CASE ${spaceMember.role} WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END`,
      sql`${spaceMember.createdAt} asc`,
    );

  if (requiredRoles.length === 0) {
    return members[0]?.userId ?? null;
  }

  const match = members.find((m) => requiredRoles.includes(m.role));
  return match?.userId ?? null;
}

async function installDefaultTasksForApp(input: {
  spaceId: string;
  appRow: {
    id: string;
    slug: string;
    appDefinition: string;
    taskDefinitions: string;
  };
}) {
  const appDefinition = safeParseJson<AppDefinition>(input.appRow.appDefinition, {
    setup: "",
  });
  const taskDefinitions = safeParseJson<AppTaskDefinition[]>(
    input.appRow.taskDefinitions,
    [],
  );

  for (let i = 0; i < taskDefinitions.length; i++) {
    const def = taskDefinitions[i];
    if (def.enabled === false) continue;

    const requiredRoles = def.requiredRoles ?? [];
    const ownerId = await resolveTaskOwner(input.spaceId, def.owner, requiredRoles);
    if (!ownerId) continue;

    const taskName = `${input.appRow.slug}-${def.name ?? `task-${i + 1}`}`;
    const existing = await db
      .select({ id: spaceTask.id })
      .from(spaceTask)
      .where(
        and(eq(spaceTask.spaceId, input.spaceId), eq(spaceTask.name, taskName)),
      )
      .then((rows) => rows[0]);
    if (existing) continue;

    const triggers = (def.triggerEvents ?? []).map(
      (t) => `${t.event}:${t.path}`,
    );

    await db.insert(spaceTask).values({
      id: randomUUID(),
      name: taskName,
      spaceId: input.spaceId,
      botId: null,
      role: def.role ?? requiredRoles[0] ?? "member",
      triggers: JSON.stringify(triggers.length > 0 ? triggers : ["memory-update:memory"]),
      plan: appDefinition.setup,
      state: "idle",
      createdBy: ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
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

  invitations: router({
    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const row = await db
          .select({
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            orgName: organization.name,
            orgSlug: organization.slug,
            orgLogo: organization.logo,
          })
          .from(invitation)
          .innerJoin(organization, eq(invitation.organizationId, organization.id))
          .where(eq(invitation.id, input.id))
          .then((rows) => rows[0]);

        if (!row) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });
        }

        // Lazy expiration: mark pending invitations past expiresAt as expired
        if (row.status === "pending" && row.expiresAt < new Date()) {
          await db
            .update(invitation)
            .set({ status: "expired" })
            .where(eq(invitation.id, input.id));
          row.status = "expired";
        }

        return {
          id: row.id,
          email: row.email,
          role: row.role,
          status: row.status,
          expiresAt: row.expiresAt,
          organization: {
            name: row.orgName,
            slug: row.orgSlug,
            logo: row.orgLogo,
          },
        };
      }),

    list: protectedProcedure
      .input(
        z.object({
          status: z.enum(["pending", "accepted", "canceled", "expired"]).optional(),
        }).optional(),
      )
      .query(async ({ ctx, input }) => {
        if (!ctx.session.activeOrganizationId) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "No active organization set." });
        }

        await verifyOrgAdmin(ctx.user.id, ctx.session.activeOrganizationId);

        const statusFilter = input?.status ?? "pending";

        // Lazy expiration: mark pending invitations past expiresAt as expired
        await db
          .update(invitation)
          .set({ status: "expired" })
          .where(
            and(
              eq(invitation.organizationId, ctx.session.activeOrganizationId),
              eq(invitation.status, "pending"),
              lt(invitation.expiresAt, new Date()),
            ),
          );

        const rows = await db
          .select({
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
            inviterId: user.id,
            inviterName: user.name,
            inviterImage: user.image,
          })
          .from(invitation)
          .innerJoin(user, eq(invitation.inviterId, user.id))
          .where(
            and(
              eq(invitation.organizationId, ctx.session.activeOrganizationId),
              eq(invitation.status, statusFilter),
            ),
          )
          .orderBy(sql`${invitation.createdAt} desc`);

        return rows.map((r) => ({
          id: r.id,
          email: r.email,
          role: r.role,
          status: r.status,
          expiresAt: r.expiresAt,
          createdAt: r.createdAt,
          inviter: {
            id: r.inviterId,
            name: r.inviterName,
            image: r.inviterImage,
          },
        }));
      }),

    resend: protectedProcedure
      .input(z.object({ invitationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.session.activeOrganizationId) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "No active organization set." });
        }

        await verifyOrgAdmin(ctx.user.id, ctx.session.activeOrganizationId);

        const existing = await db
          .select()
          .from(invitation)
          .where(eq(invitation.id, input.invitationId))
          .then((rows) => rows[0]);

        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });
        }

        if (existing.organizationId !== ctx.session.activeOrganizationId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });
        }

        // Check lazy expiration
        const effectiveStatus =
          existing.status === "pending" && existing.expiresAt < new Date()
            ? "expired"
            : existing.status;

        if (effectiveStatus !== "pending" && effectiveStatus !== "expired") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only pending or expired invitations can be resent.",
          });
        }

        // Create new invitation via Better Auth BEFORE canceling the old one
        // so the old invitation is only canceled if a replacement exists
        const headers = new Headers();
        headers.set("cookie", `better-auth.session_token=${ctx.session.token}`);

        await auth.api.createInvitation({
          headers,
          body: {
            email: existing.email,
            role: (existing.role ?? "member") as "member" | "owner" | "admin",
            organizationId: ctx.session.activeOrganizationId,
          },
        });

        // Find the newly created invitation
        const newInv = await db
          .select({ id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt })
          .from(invitation)
          .where(
            and(
              eq(invitation.organizationId, ctx.session.activeOrganizationId),
              eq(invitation.email, existing.email),
              eq(invitation.status, "pending"),
              sql`${invitation.id} != ${input.invitationId}`,
            ),
          )
          .orderBy(sql`${invitation.createdAt} desc`)
          .then((rows) => rows[0]);

        if (!newInv) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create new invitation." });
        }

        // Cancel the old invitation only after the new one is confirmed
        await db
          .update(invitation)
          .set({ status: "canceled" })
          .where(eq(invitation.id, input.invitationId));

        return {
          id: newInv.id,
          email: newInv.email,
          expiresAt: newInv.expiresAt,
        };
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

    members: router({
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

          // Any org member can view space members
          await verifyOrgMember(ctx.user.id, spaceRow.organizationId);

          const rows = await db
            .select({
              id: spaceMember.id,
              userId: spaceMember.userId,
              role: spaceMember.role,
              createdAt: spaceMember.createdAt,
              userName: user.name,
              userEmail: user.email,
              userImage: user.image,
            })
            .from(spaceMember)
            .innerJoin(user, eq(spaceMember.userId, user.id))
            .where(eq(spaceMember.spaceId, input.spaceId))
            .orderBy(
              sql`CASE ${spaceMember.role} WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END`,
              sql`${spaceMember.createdAt} asc`,
            );

          return rows.map((r) => ({
            id: r.id,
            userId: r.userId,
            role: r.role,
            createdAt: r.createdAt,
            user: {
              id: r.userId,
              name: r.userName,
              email: r.userEmail,
              image: r.userImage,
            },
          }));
        }),

      add: protectedProcedure
        .input(
          z.object({
            spaceId: z.string(),
            userId: z.string(),
            role: z.enum(["owner", "admin", "member"]).default("member"),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          await verifySpaceAdmin(ctx.user.id, input.spaceId);

          // Get the space's org
          const spaceRow = await db
            .select({ organizationId: space.organizationId })
            .from(space)
            .where(eq(space.id, input.spaceId))
            .then((rows) => rows[0]);

          if (!spaceRow) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Space not found." });
          }

          // Validate target user is an org member
          const orgMemberRow = await db
            .select({ id: member.id })
            .from(member)
            .where(and(eq(member.userId, input.userId), eq(member.organizationId, spaceRow.organizationId)))
            .then((rows) => rows[0]);

          if (!orgMemberRow) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "User is not a member of this organization." });
          }

          // Check for existing space membership
          const existingMember = await db
            .select({ id: spaceMember.id })
            .from(spaceMember)
            .where(and(eq(spaceMember.spaceId, input.spaceId), eq(spaceMember.userId, input.userId)))
            .then((rows) => rows[0]);

          if (existingMember) {
            throw new TRPCError({ code: "CONFLICT", message: "User is already a member of this space." });
          }

          const id = randomUUID();
          const now = new Date();

          await db.insert(spaceMember).values({
            id,
            spaceId: input.spaceId,
            userId: input.userId,
            role: input.role,
            createdAt: now,
          });

          return { id, userId: input.userId, role: input.role, createdAt: now };
        }),

      updateRole: protectedProcedure
        .input(
          z.object({
            spaceId: z.string(),
            userId: z.string(),
            role: z.enum(["owner", "admin", "member"]),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          const authResult = await verifySpaceAdmin(ctx.user.id, input.spaceId);

          // Only space owners and org admins/owners can change roles
          const isSpaceOwner = authResult.spaceRole === "owner";
          const isOrgAdmin = authResult.orgRole && ["owner", "admin"].includes(authResult.orgRole);
          if (!isSpaceOwner && !isOrgAdmin) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Only space owners and org admins can change roles." });
          }

          const targetMember = await db
            .select({ id: spaceMember.id, role: spaceMember.role })
            .from(spaceMember)
            .where(and(eq(spaceMember.spaceId, input.spaceId), eq(spaceMember.userId, input.userId)))
            .then((rows) => rows[0]);

          if (!targetMember) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Member not found in this space." });
          }

          // Guard: cannot demote the last owner
          if (targetMember.role === "owner" && input.role !== "owner") {
            const ownerCount = await db
              .select({ count: count() })
              .from(spaceMember)
              .where(and(eq(spaceMember.spaceId, input.spaceId), eq(spaceMember.role, "owner")))
              .then((rows) => rows[0]?.count ?? 0);

            if (ownerCount <= 1) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot demote the last space owner." });
            }
          }

          await db
            .update(spaceMember)
            .set({ role: input.role })
            .where(and(eq(spaceMember.spaceId, input.spaceId), eq(spaceMember.userId, input.userId)));

          return { userId: input.userId, role: input.role };
        }),

      remove: protectedProcedure
        .input(z.object({ spaceId: z.string(), userId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const authResult = await verifySpaceAdmin(ctx.user.id, input.spaceId);

          const targetMember = await db
            .select({ id: spaceMember.id, role: spaceMember.role })
            .from(spaceMember)
            .where(and(eq(spaceMember.spaceId, input.spaceId), eq(spaceMember.userId, input.userId)))
            .then((rows) => rows[0]);

          if (!targetMember) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Member not found in this space." });
          }

          // Space admins cannot remove space owners
          if (targetMember.role === "owner" && authResult.spaceRole === "admin" && !authResult.orgRole?.match(/^(owner|admin)$/)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Space admins cannot remove space owners." });
          }

          // Guard: cannot remove the last owner
          if (targetMember.role === "owner") {
            const ownerCount = await db
              .select({ count: count() })
              .from(spaceMember)
              .where(and(eq(spaceMember.spaceId, input.spaceId), eq(spaceMember.role, "owner")))
              .then((rows) => rows[0]?.count ?? 0);

            if (ownerCount <= 1) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove the last space owner." });
            }
          }

          await db
            .delete(spaceMember)
            .where(and(eq(spaceMember.spaceId, input.spaceId), eq(spaceMember.userId, input.userId)));

          return { ok: true as const };
        }),
    }),

    apps: router({
      catalog: protectedProcedure
        .input(
          z
            .object({
              spaceId: z.string().optional(),
            })
            .optional(),
        )
        .query(async ({ ctx, input }) => {
          if (!ctx.session.activeOrganizationId) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "No active organization set.",
            });
          }

          await verifyOrgMember(ctx.user.id, ctx.session.activeOrganizationId);
          await ensureSeedAppsForOrg(ctx.session.activeOrganizationId);

          if (input?.spaceId) {
            const spaceRow = await db
              .select({ id: space.id, organizationId: space.organizationId })
              .from(space)
              .where(eq(space.id, input.spaceId))
              .then((rows) => rows[0]);
            if (!spaceRow) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Space not found.",
              });
            }
            await verifyOrgMember(ctx.user.id, spaceRow.organizationId);
          }

          const rows = await db
            .select({
              id: app.id,
              name: app.name,
              slug: app.slug,
              description: app.description,
              enabled: app.enabled,
              navigation: app.navigation,
              subspacePath: app.subspacePath,
              appDefinition: app.appDefinition,
              taskDefinitions: app.taskDefinitions,
            })
            .from(app)
            .where(eq(app.organizationId, ctx.session.activeOrganizationId))
            .orderBy(sql`${app.name} asc`);

          let installedByAppId = new Set<string>();
          if (input?.spaceId) {
            const installed = await db
              .select({ appId: spaceApp.appId })
              .from(spaceApp)
              .where(eq(spaceApp.spaceId, input.spaceId));
            installedByAppId = new Set(installed.map((r) => r.appId));
          }

          return rows.map((r) => ({
            id: r.id,
            name: r.name,
            slug: r.slug,
            description: r.description,
            enabled: r.enabled,
            navigation: safeParseJson<string[]>(r.navigation, []),
            subspacePath: r.subspacePath,
            appDefinition: safeParseJson<AppDefinition>(r.appDefinition, { setup: "" }),
            taskDefinitions: safeParseJson<AppTaskDefinition[]>(r.taskDefinitions, []),
            installed: installedByAppId.has(r.id),
          }));
        }),

      listInstalled: protectedProcedure
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
          await ensureSeedAppsForOrg(spaceRow.organizationId);

          const rows = await db
            .select({
              id: spaceApp.id,
              installedAt: spaceApp.installedAt,
              appId: app.id,
              appName: app.name,
              appSlug: app.slug,
              description: app.description,
              enabled: app.enabled,
              navigation: app.navigation,
              subspacePath: app.subspacePath,
              appDefinition: app.appDefinition,
              taskDefinitions: app.taskDefinitions,
            })
            .from(spaceApp)
            .innerJoin(app, eq(spaceApp.appId, app.id))
            .where(eq(spaceApp.spaceId, input.spaceId))
            .orderBy(sql`${spaceApp.installedAt} desc`);

          return rows.map((r) => ({
            id: r.id,
            installedAt: r.installedAt,
            app: {
              id: r.appId,
              name: r.appName,
              slug: r.appSlug,
              description: r.description,
              enabled: r.enabled,
              navigation: safeParseJson<string[]>(r.navigation, []),
              subspacePath: r.subspacePath,
              appDefinition: safeParseJson<AppDefinition>(r.appDefinition, { setup: "" }),
              taskDefinitions: safeParseJson<AppTaskDefinition[]>(r.taskDefinitions, []),
            },
          }));
        }),

      install: protectedProcedure
        .input(
          z.object({
            spaceId: z.string(),
            appId: z.string().optional(),
            appSlug: z.string().optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          if (!input.appId && !input.appSlug) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Provide appId or appSlug.",
            });
          }

          const auth = await verifySpaceAdmin(ctx.user.id, input.spaceId);
          await ensureSeedAppsForOrg(auth.organizationId);

          const appRow = await db
            .select({
              id: app.id,
              slug: app.slug,
              enabled: app.enabled,
              organizationId: app.organizationId,
              appDefinition: app.appDefinition,
              taskDefinitions: app.taskDefinitions,
            })
            .from(app)
            .where(
              and(
                eq(app.organizationId, auth.organizationId),
                input.appId ? eq(app.id, input.appId) : eq(app.slug, input.appSlug!),
              ),
            )
            .then((rows) => rows[0]);

          if (!appRow) {
            throw new TRPCError({ code: "NOT_FOUND", message: "App not found." });
          }
          if (!appRow.enabled) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "App is disabled and cannot be installed.",
            });
          }

          const existingInstall = await db
            .select({ id: spaceApp.id })
            .from(spaceApp)
            .where(
              and(
                eq(spaceApp.spaceId, input.spaceId),
                eq(spaceApp.appId, appRow.id),
              ),
            )
            .then((rows) => rows[0]);

          if (existingInstall) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "App is already installed in this space.",
            });
          }

          const installId = randomUUID();
          await db.insert(spaceApp).values({
            id: installId,
            spaceId: input.spaceId,
            appId: appRow.id,
            appSlug: appRow.slug,
            installedBy: ctx.user.id,
            installedAt: new Date(),
          });

          await installDefaultTasksForApp({
            spaceId: input.spaceId,
            appRow: {
              id: appRow.id,
              slug: appRow.slug,
              appDefinition: appRow.appDefinition,
              taskDefinitions: appRow.taskDefinitions,
            },
          });

          return { id: installId, appId: appRow.id, appSlug: appRow.slug };
        }),

      uninstall: protectedProcedure
        .input(
          z.object({
            spaceId: z.string(),
            appId: z.string().optional(),
            appSlug: z.string().optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          if (!input.appId && !input.appSlug) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Provide appId or appSlug.",
            });
          }

          const auth = await verifySpaceAdmin(ctx.user.id, input.spaceId);

          const install = await db
            .select({
              id: spaceApp.id,
              appId: spaceApp.appId,
              appSlug: spaceApp.appSlug,
              appOrgId: app.organizationId,
            })
            .from(spaceApp)
            .innerJoin(app, eq(spaceApp.appId, app.id))
            .where(
              and(
                eq(spaceApp.spaceId, input.spaceId),
                input.appId ? eq(spaceApp.appId, input.appId) : eq(spaceApp.appSlug, input.appSlug!),
              ),
            )
            .then((rows) => rows[0]);

          if (!install || install.appOrgId !== auth.organizationId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "App install not found in this space.",
            });
          }

          await db.delete(spaceApp).where(eq(spaceApp.id, install.id));
          return { ok: true as const, appId: install.appId, appSlug: install.appSlug };
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;

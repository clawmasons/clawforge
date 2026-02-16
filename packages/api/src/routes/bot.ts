import type { FastifyInstance } from "fastify";
import { eq, and, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "../db/index.js";
import { bot, space } from "../db/schema.js";
import { tokenAuthHook } from "../middleware/token-auth.js";

export async function botRoutes(app: FastifyInstance) {
  // All bot routes require token auth
  app.addHook("preHandler", tokenAuthHook);

  // GET /bot/:nameOrId
  app.get<{ Params: { nameOrId: string } }>(
    "/bot/:nameOrId",
    async (request, reply) => {
      const { nameOrId } = request.params;
      const orgId = request.tokenAuth!.organizationId;

      const row = await db
        .select()
        .from(bot)
        .where(
          and(
            eq(bot.organizationId, orgId),
            or(eq(bot.id, nameOrId), eq(bot.name, nameOrId)),
          ),
        )
        .then((rows) => rows[0]);

      if (!row) {
        return reply.status(404).send({ error: "Bot not found" });
      }
      return row;
    },
  );

  // POST /bot/create
  app.post<{
    Body: {
      id?: string;
      name: string;
      spaceId?: string;
      role?: string;
      ownerId?: string;
    };
  }>("/bot/create", async (request, reply) => {
    const { name, spaceId, role, ownerId } = request.body;
    const orgId = request.tokenAuth!.organizationId;
    const id = request.body.id ?? randomUUID();
    const resolvedOwnerId = ownerId ?? request.tokenAuth!.createdBy;

    // Check for duplicate name within org
    const existing = await db
      .select({ id: bot.id })
      .from(bot)
      .where(and(eq(bot.organizationId, orgId), eq(bot.name, name)))
      .then((rows) => rows[0]);

    if (existing) {
      return reply
        .status(409)
        .send({ error: `Bot with name "${name}" already exists in this org` });
    }

    // Resolve space slug to UUID
    let resolvedSpaceId: string | null = null;
    if (spaceId) {
      const sp = await db
        .select({ id: space.id })
        .from(space)
        .where(
          and(
            eq(space.organizationId, orgId),
            or(eq(space.id, spaceId), eq(space.spaceId, spaceId)),
          ),
        )
        .then((rows) => rows[0]);

      if (!sp) {
        return reply
          .status(404)
          .send({ error: `Space "${spaceId}" not found` });
      }
      resolvedSpaceId = sp.id;
    }

    const row = {
      id,
      name,
      organizationId: orgId,
      ownerId: resolvedOwnerId,
      currentSpaceId: resolvedSpaceId,
      currentRole: role ?? null,
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(bot).values(row);
    return reply.status(201).send(row);
  });

  // PUT /bot/:nameOrId/update
  app.put<{
    Params: { nameOrId: string };
    Body: {
      name?: string;
      spaceId?: string;
      role?: string;
      status?: string;
    };
  }>("/bot/:nameOrId/update", async (request, reply) => {
    const { nameOrId } = request.params;
    const orgId = request.tokenAuth!.organizationId;

    const existing = await db
      .select({ id: bot.id })
      .from(bot)
      .where(
        and(
          eq(bot.organizationId, orgId),
          or(eq(bot.id, nameOrId), eq(bot.name, nameOrId)),
        ),
      )
      .then((rows) => rows[0]);

    if (!existing) {
      return reply.status(404).send({ error: "Bot not found" });
    }

    const updates: Record<string, unknown> = {};
    if (request.body.name != null) updates.name = request.body.name;
    if (request.body.spaceId !== undefined) {
      if (request.body.spaceId === null) {
        updates.currentSpaceId = null;
      } else {
        const sp = await db
          .select({ id: space.id })
          .from(space)
          .where(
            and(
              eq(space.organizationId, orgId),
              or(
                eq(space.id, request.body.spaceId),
                eq(space.spaceId, request.body.spaceId),
              ),
            ),
          )
          .then((rows) => rows[0]);

        if (!sp) {
          return reply
            .status(404)
            .send({ error: `Space "${request.body.spaceId}" not found` });
        }
        updates.currentSpaceId = sp.id;
      }
    }
    if (request.body.role !== undefined)
      updates.currentRole = request.body.role;
    if (request.body.status != null) updates.status = request.body.status;

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    await db.update(bot).set(updates).where(eq(bot.id, existing.id));

    const updated = await db
      .select()
      .from(bot)
      .where(eq(bot.id, existing.id))
      .then((rows) => rows[0]);

    return updated;
  });

  // POST /bot/:nameOrId/stop
  app.post<{ Params: { nameOrId: string } }>(
    "/bot/:nameOrId/stop",
    async (request, reply) => {
      const { nameOrId } = request.params;
      const orgId = request.tokenAuth!.organizationId;

      const existing = await db
        .select({ id: bot.id })
        .from(bot)
        .where(
          and(
            eq(bot.organizationId, orgId),
            or(eq(bot.id, nameOrId), eq(bot.name, nameOrId)),
          ),
        )
        .then((rows) => rows[0]);

      if (!existing) {
        return reply.status(404).send({ error: "Bot not found" });
      }

      await db
        .update(bot)
        .set({ status: "stopped" })
        .where(eq(bot.id, existing.id));

      return { ok: true };
    },
  );
}

import type { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { hashToken } from "../lib/token.js";
import { db } from "../db/index.js";
import { orgApiToken, organization } from "../db/schema.js";

export interface TokenAuth {
  tokenId: string;
  organizationId: string;
  createdBy: string;
}

declare module "fastify" {
  interface FastifyRequest {
    tokenAuth?: TokenAuth;
  }
}

/** Fastify preHandler hook that validates Bearer API tokens. */
export async function tokenAuthHook(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing or invalid Authorization header" });
  }

  const raw = header.slice(7);
  const hash = hashToken(raw);

  const row = await db
    .select({
      id: orgApiToken.id,
      organizationId: orgApiToken.organizationId,
      enabled: orgApiToken.enabled,
      createdBy: orgApiToken.createdBy,
    })
    .from(orgApiToken)
    .where(eq(orgApiToken.tokenHash, hash))
    .then((rows) => rows[0]);

  if (!row || !row.enabled) {
    return reply.status(401).send({ error: "Invalid or disabled token" });
  }

  request.tokenAuth = {
    tokenId: row.id,
    organizationId: row.organizationId,
    createdBy: row.createdBy,
  };

  // Fire-and-forget lastUsedAt update
  db.update(orgApiToken)
    .set({ lastUsedAt: new Date() })
    .where(eq(orgApiToken.id, row.id))
    .catch(() => {});
}

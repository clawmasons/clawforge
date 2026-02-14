import { randomBytes, createHash } from "crypto";

const PREFIX = "clf_";

/** Generate a new API token with raw value, SHA-256 hash, and display prefix. */
export function generateApiToken(): { raw: string; hash: string; prefix: string } {
  const raw = PREFIX + randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw), prefix: raw.slice(0, 12) };
}

/** Hash a raw token string with SHA-256. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

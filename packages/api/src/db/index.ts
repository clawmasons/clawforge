import { Signer } from "@aws-sdk/rds-signer";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/clawforge";

let poolConfig: pg.PoolConfig;

if (process.env.AWS_REGION) {
  // In AWS: use IAM auth token instead of connection string to avoid
  // pg.Pool merging issues where connectionString password wins
  const url = new URL(connectionString);
  const signer = new Signer({
    hostname: url.hostname,
    port: parseInt(url.port || "5432"),
    username: url.username,
    region: process.env.AWS_REGION,
  });
  const token = await signer.getAuthToken();
  poolConfig = {
    host: url.hostname,
    port: parseInt(url.port || "5432"),
    user: url.username,
    password: token,
    database: url.pathname.slice(1), // strip leading /
    ssl: { rejectUnauthorized: false },
  };
} else {
  poolConfig = { connectionString };
}

export const pool = new pg.Pool(poolConfig);

export const db = drizzle(pool, { schema });

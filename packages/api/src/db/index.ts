import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/clawforge",
});

export const db = drizzle(pool, { schema });

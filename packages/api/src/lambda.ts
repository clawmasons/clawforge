import awsLambdaFastify from "@fastify/aws-lambda";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "./app.js";
import { pool } from "./db/index.js";

const app = createApp();
const proxy = app.then((server) => awsLambdaFastify(server));

export const handler: import("aws-lambda").Handler = async (event, context) => {
  const p = await proxy;
  return p(event, context);
};

export const migrateHandler: import("aws-lambda").Handler = async () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.join(__dirname, "drizzle");

  try {
    // Create tracking table (no CREATE SCHEMA needed)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
      )
    `);

    // Read journal to find migrations
    const journal = JSON.parse(
      fs.readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf-8")
    );

    // Get already-applied migration hashes
    const applied = await pool.query(`SELECT hash FROM "__drizzle_migrations"`);
    const appliedHashes = new Set(applied.rows.map((r: any) => r.hash));

    // Apply pending migrations in order
    const pending = journal.entries.filter((e: any) => !appliedHashes.has(e.tag));
    for (const entry of pending) {
      const filePath = path.join(migrationsFolder, `${entry.tag}.sql`);
      const sqlContent = fs.readFileSync(filePath, "utf-8");

      const statements = sqlContent.split("--> statement-breakpoint").filter((s: string) => s.trim());
      for (const stmt of statements) {
        await pool.query(stmt);
      }

      await pool.query(
        `INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
        [entry.tag, Date.now()]
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Applied ${pending.length} migration(s)` }),
    };
  } catch (err: any) {
    throw new Error(
      `Migration failed: ${err.message} | code: ${err.code} | detail: ${err.detail}`
    );
  }
};

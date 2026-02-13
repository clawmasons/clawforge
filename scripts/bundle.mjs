#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const bundleDir = join(repoRoot, "bundle");

// Clean previous bundle
rmSync(bundleDir, { recursive: true, force: true });
mkdirSync(bundleDir, { recursive: true });

// ── Build API and Web ──────────────────────────────────────────────
console.log("Building API...");
execSync("pnpm --filter @clawforge/api build", {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log("Building Web...");
execSync("NEXT_PUBLIC_API_URL=http://localhost:4000 pnpm --filter @clawforge/web build:next", {
  cwd: repoRoot,
  stdio: "inherit",
});

// ── Copy pre-built artifacts ───────────────────────────────────────

// API: compiled JS + package.json
cpSync(join(repoRoot, "packages/api/dist"), join(bundleDir, "packages/api/dist"), {
  recursive: true,
});
cpSync(
  join(repoRoot, "packages/api/package.json"),
  join(bundleDir, "packages/api/package.json"),
);

// Web: standalone server + static assets + package.json
// Use cp -rL to dereference symlinks — pnpm's standalone output contains
// absolute symlinks into .pnpm that won't resolve inside Docker.
mkdirSync(join(bundleDir, "packages/web/.next"), { recursive: true });
execSync(
  `cp -rL "${join(repoRoot, "packages/web/.next/standalone")}" "${join(bundleDir, "packages/web/.next/standalone")}"`,
  { stdio: "inherit" },
);
cpSync(
  join(repoRoot, "packages/web/.next/static"),
  join(bundleDir, "packages/web/.next/static"),
  { recursive: true },
);
cpSync(
  join(repoRoot, "packages/web/package.json"),
  join(bundleDir, "packages/web/package.json"),
);

// Shared: package.json only (for pnpm workspace resolution)
mkdirSync(join(bundleDir, "packages/shared"), { recursive: true });
cpSync(
  join(repoRoot, "packages/shared/package.json"),
  join(bundleDir, "packages/shared/package.json"),
);

// Infra
cpSync(
  join(repoRoot, "infra/clawforge-server"),
  join(bundleDir, "infra/clawforge-server"),
  { recursive: true },
);
cpSync(join(repoRoot, "infra/bot"), join(bundleDir, "infra/bot"), {
  recursive: true,
});

// Root config files needed for pnpm install
const rootFiles = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"];
for (const file of rootFiles) {
  cpSync(join(repoRoot, file), join(bundleDir, file));
}

// ── Install production dependencies in bundle ──────────────────────
console.log("Installing production dependencies...");
execSync("pnpm install --frozen-lockfile --prod", {
  cwd: bundleDir,
  stdio: "inherit",
});

// Override repo-root .dockerignore so Docker context includes node_modules/.next
writeFileSync(join(bundleDir, ".dockerignore"), ".git\n");

console.log("Bundle created at bundle/");

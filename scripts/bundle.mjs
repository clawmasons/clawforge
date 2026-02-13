#!/usr/bin/env node
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const bundleDir = join(repoRoot, "bundle");

// Clean previous bundle
rmSync(bundleDir, { recursive: true, force: true });
mkdirSync(bundleDir, { recursive: true });

// ── Copy CLI dependencies ────────────────────────────────────────

// Bot infrastructure files (needed by `clawforge bot start`)
cpSync(join(repoRoot, "infra/bot"), join(bundleDir, "infra/bot"), {
  recursive: true,
});

// Workspace package.json stubs (needed for pnpm to resolve the lockfile)
for (const pkg of ["api", "shared", "web", "server"]) {
  mkdirSync(join(bundleDir, `packages/${pkg}`), { recursive: true });
  cpSync(
    join(repoRoot, `packages/${pkg}/package.json`),
    join(bundleDir, `packages/${pkg}/package.json`),
  );
}

// Root config files needed for pnpm install
const rootFiles = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"];
for (const file of rootFiles) {
  cpSync(join(repoRoot, file), join(bundleDir, file));
}

// Write .npmrc with shamefully-hoist so deps are hoisted to bundle/node_modules/
// (the CLI at packages/cli/ needs to resolve deps via parent directory traversal)
writeFileSync(
  join(bundleDir, ".npmrc"),
  "auto-install-peers=true\nstrict-peer-dependencies=false\nshamefully-hoist=true\n",
);

// ── Install production dependencies in bundle ──────────────────────
console.log("Installing production dependencies...");
execSync("pnpm install --frozen-lockfile --prod", {
  cwd: bundleDir,
  stdio: "inherit",
});

// ── Rewrite bundle package.json for publishing ──────────────────────
const rootPkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const serverPkg = JSON.parse(readFileSync(join(repoRoot, "packages/server/package.json"), "utf8"));

writeFileSync(
  join(bundleDir, "package.json"),
  JSON.stringify(
    {
      name: rootPkg.name,
      version: rootPkg.version,
      type: "module",
      bin: { clawforge: "./packages/cli/cli.js" },
      dependencies: serverPkg.dependencies,
      engines: rootPkg.engines,
    },
    null,
    2,
  ) + "\n",
);

// ── Clean up workspace stubs (only needed for install) ──────────────
for (const pkg of ["api", "shared", "web", "server"]) {
  rmSync(join(bundleDir, `packages/${pkg}`), { recursive: true, force: true });
}
rmSync(join(bundleDir, "pnpm-workspace.yaml"), { force: true });
rmSync(join(bundleDir, "pnpm-lock.yaml"), { force: true });

console.log("Bundle created at bundle/");

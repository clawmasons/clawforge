#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(__dirname, "..");
const repoRoot = resolve(serverDir, "..", "..");
const bundleDir = join(serverDir, "bundle");

// Clean previous bundle
rmSync(bundleDir, { recursive: true, force: true });
mkdirSync(bundleDir, { recursive: true });

// Directories/files to skip everywhere
const EXCLUDE = new Set([
  "node_modules",
  ".next",
  ".open-next",
  ".source",
  "dist",
  "dist-lambda",
  "out",
]);

function filter(src) {
  const name = src.split("/").pop();
  return !EXCLUDE.has(name);
}

// Package sources
const packages = ["packages/web", "packages/api", "packages/shared"];
for (const pkg of packages) {
  cpSync(join(repoRoot, pkg), join(bundleDir, pkg), {
    recursive: true,
    filter,
  });
}

// Infra (compose + Dockerfiles + bot)
cpSync(
  join(repoRoot, "infra", "clawforge-server"),
  join(bundleDir, "infra", "clawforge-server"),
  { recursive: true, filter },
);
cpSync(join(repoRoot, "infra", "bot"), join(bundleDir, "infra", "bot"), {
  recursive: true,
  filter,
});

// Docs (needed by web Dockerfile)
cpSync(join(repoRoot, "docs"), join(bundleDir, "docs"), {
  recursive: true,
  filter,
});

// Root config files needed by Docker builds
const rootFiles = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  ".npmrc",
];
for (const file of rootFiles) {
  cpSync(join(repoRoot, file), join(bundleDir, file));
}

console.log("Bundle created at packages/server/bundle/");

#!/usr/bin/env node
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const bundleDir = join(repoRoot, "bundle");
const outFile = join(bundleDir, "packages/cli/cli.js");

// Resolve esbuild from the server workspace (it's a devDependency there)
const require = createRequire(join(repoRoot, "packages/server/package.json"));
const { build } = require("esbuild");

// Clean previous bundle
rmSync(bundleDir, { recursive: true, force: true });
mkdirSync(bundleDir, { recursive: true });

// ── Bundle yjs-server into infra dir (before copying infra/bot) ──────
console.log("Bundling yjs-server with esbuild...");
await build({
  entryPoints: [join(repoRoot, "packages/yjs-server/src/server.ts")],
  outfile: join(repoRoot, "infra/bot/common/docker/yjs/yjs-server.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  banner: {
    js: [
      'import { createRequire as __bundleCreateRequire } from "node:module";',
      "const require = __bundleCreateRequire(import.meta.url);",
    ].join("\n"),
  },
});

// ── Bundle yjs-plugin into infra dir (before copying infra/bot) ──────
console.log("Bundling yjs-plugin with esbuild...");
await build({
  entryPoints: [join(repoRoot, "packages/yjs-plugin/src/index.ts")],
  outfile: join(repoRoot, "infra/bot/common/docker/openclaw/yjs-plugin.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  banner: {
    js: [
      'import { createRequire as __bundleCreateRequire } from "node:module";',
      "const require = __bundleCreateRequire(import.meta.url);",
    ].join("\n"),
  },
});

// ── Copy bot infrastructure files (needed by `clawforge bot start`) ──
cpSync(join(repoRoot, "infra/bot"), join(bundleDir, "infra/bot"), {
  recursive: true,
});

// ── Bundle CLI with esbuild ──────────────────────────────────────────
console.log("Bundling CLI with esbuild...");
await build({
  entryPoints: [join(repoRoot, "packages/server/src/cli.ts")],
  outfile: outFile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // Provide a real require() so esbuild's CJS-to-ESM shim can resolve Node builtins
  banner: {
    js: [
      "#!/usr/bin/env node",
      'import { createRequire as __bundleCreateRequire } from "node:module";',
      "const require = __bundleCreateRequire(import.meta.url);",
    ].join("\n"),
  },
});

chmodSync(outFile, 0o755);

// ── Write bundle package.json for npm publishing ─────────────────────
const rootPkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

writeFileSync(
  join(bundleDir, "package.json"),
  JSON.stringify(
    {
      name: rootPkg.name,
      version: rootPkg.version,
      type: "module",
      bin: { clawforge: "./packages/cli/cli.js" },
      engines: rootPkg.engines,
    },
    null,
    2,
  ) + "\n",
);

console.log("Bundle created at bundle/");

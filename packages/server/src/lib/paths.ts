import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Bundled CLI lives at bundle/packages/cli/cli.js → go up 2 levels */
export const bundleRoot = join(__dirname, "..", "..");

/** Directory containing bot infrastructure files */
export const botInfraDir = join(bundleRoot, "infra", "bot");

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Bundled monorepo source (bundle/packages/cli/lib -> ../../../) */
export const bundleRoot = join(__dirname, "..", "..", "..");

/** Directory containing bot infrastructure files */
export const botInfraDir = join(bundleRoot, "infra", "bot");

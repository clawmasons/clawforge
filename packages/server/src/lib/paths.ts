import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Bundled monorepo source (bundle/packages/cli/lib -> ../../../) */
export const bundleRoot = join(__dirname, "..", "..", "..");

/** Directory containing infra compose files */
export const composeDir = join(bundleRoot, "infra", "clawforge-server");

/** Directory containing bot infrastructure files */
export const botInfraDir = join(bundleRoot, "infra", "bot");

/** Get the absolute path to the org server compose file */
export function getComposeFile(): string {
  return join(composeDir, "docker-compose.yml");
}

import fs from "node:fs";
import { stringify, parse } from "yaml";

const CONFIG_FILE = "clawforge.yaml";

export interface ClawforgeConfig {
  "bot-server": {
    id: string;
    name: string;
  };
  "org-server": {
    host: string;
  };
}

/** Check if clawforge.yaml exists in the current directory */
export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

/** Read and parse clawforge.yaml */
export function readConfig(): ClawforgeConfig {
  const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
  return parse(raw) as ClawforgeConfig;
}

/** Write clawforge.yaml */
export function writeConfig(config: ClawforgeConfig): void {
  fs.writeFileSync(CONFIG_FILE, stringify(config));
}

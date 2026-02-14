import fs from "node:fs";
import path from "node:path";
import { stringify, parse } from "yaml";

const CONFIG_FILE = "clawforge.yaml";
const BOT_CONFIG_FILE = "bot.yaml";

export interface ClawforgeConfig {
  "bot-server": {
    id: string;
    name: string;
  };
  "org-server": {
    host: string;
  };
}

export interface BotConfig {
  id: string;
  name: string;
  organizationId: string;
  programId?: string;
  role?: string;
  status: string;
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

/** Read bot.yaml from a bot directory */
export function readBotConfig(botDir: string): BotConfig | null {
  const filePath = path.join(botDir, BOT_CONFIG_FILE);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return parse(raw) as BotConfig;
}

/** Write bot.yaml to a bot directory */
export function writeBotConfig(botDir: string, config: BotConfig): void {
  const filePath = path.join(botDir, BOT_CONFIG_FILE);
  fs.writeFileSync(filePath, stringify(config));
}

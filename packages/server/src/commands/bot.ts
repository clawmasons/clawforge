import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { generateName } from "../lib/names.js";
import { detectPlatform } from "../lib/platform.js";
import { run, capture } from "../lib/exec.js";
import { botInfraDir } from "../lib/paths.js";
import {
  getBot,
  createBot,
  stopBot,
} from "../lib/api.js";
import { writeBotConfig } from "../lib/config.js";

const BOTS_DIR = "bots";

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirRecursive(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** Resolve a bot name/id to its directory path, following symlinks */
function resolveBotDir(nameOrId: string): string | null {
  const direct = path.join(BOTS_DIR, nameOrId);
  if (fs.existsSync(direct)) {
    // Follow symlink to get the real path
    return fs.realpathSync(direct);
  }
  return null;
}

export function registerBotCommand(program: Command) {
  const bot = program
    .command("bot")
    .description("Manage clawforge bots");

  bot
    .command("start")
    .description("Start a new bot instance")
    .option("--program <program>", "Program slug")
    .option("--role <role>", "Role slug")
    .option("--name <name>", "Bot name (default: random fun name)")
    .action(
      async (opts: {
        program?: string;
        role?: string;
        name?: string;
      }) => {
        const botId = nanoid(12);
        const botName = opts.name ?? generateName();

        // Register bot with the server (org comes from token scope)
        let serverBot: Awaited<ReturnType<typeof getBot>> = null;
        try {
          serverBot = await getBot(botName);
          if (!serverBot) {
            serverBot = await createBot({
              id: botId,
              name: botName,
              programId: opts.program,
              role: opts.role,
            });
            console.log(`Registered bot on server: ${serverBot.id}`);
          } else {
            console.log(`Bot "${botName}" already registered (${serverBot.id})`);
          }
        } catch (err) {
          console.log(`Warning: could not register bot with server (${(err as Error).message}). Continuing locally.`);
        }

        // Create directory structure
        const botDir = path.join(BOTS_DIR, botId);
        for (const sub of ["workspace", "openclaw", "tmp"]) {
          ensureDir(path.join(botDir, sub));
        }
        console.log(`Created bot directory: ${botDir}`);

        // Write bot.yaml with server-returned or local info
        writeBotConfig(botDir, {
          id: serverBot?.id ?? botId,
          name: serverBot?.name ?? botName,
          organizationId: serverBot?.organizationId ?? "",
          programId: serverBot?.currentProgramId ?? opts.program,
          role: serverBot?.currentRole ?? opts.role,
          status: serverBot?.status ?? "running",
        });
        console.log(`Wrote bot.yaml`);

        // Create name symlink
        const symlinkPath = path.join(BOTS_DIR, botName);
        if (!fs.existsSync(symlinkPath)) {
          fs.symlinkSync(botId, symlinkPath);
          console.log(`Created symlink: ${symlinkPath} -> ${botId}`);
        }

        // Copy common infra files
        const commonDir = path.join(botInfraDir, "common");
        console.log(commonDir);
        console.log(botDir)
        copyDirRecursive(commonDir, botDir);
        console.log(`Copied common infra files`);

        // Detect platform and overlay arch-specific files
        const platform = detectPlatform();
        const archDir = path.join(botInfraDir, platform);
        if (fs.existsSync(archDir)) {
          copyDirRecursive(archDir, botDir);
          console.log(`Overlaid ${platform} files`);
        }

        // chmod +x and run extract-home.sh if it exists
        const extractScript = path.join("./", "scripts", "extract-home.sh");
        if (fs.existsSync(extractScript)) {
          run(`chmod +x "${extractScript}"`);
          run(`"${extractScript}"`, { cwd: botDir });
          console.log(`Ran extract-home.sh`);
        }

        // Copy home.orig -> home
        const homeOrig = path.join(botDir, "home.orig");
        const home = path.join(botDir, "home");
        if (fs.existsSync(homeOrig)) {
          copyDirRecursive(homeOrig, home);
          console.log(`Copied home.orig -> home`);
        }

        // Write .env for docker-compose variable interpolation
        const composePath = path.join(botDir, "docker-compose.yml");
        const envPath = path.join(botDir, ".env");
        fs.writeFileSync(
          envPath,
          [
            `CLAWFORGE_API_URL=${process.env.CLAWFORGE_API_URL ?? "http://localhost:4000"}`,
            `CLAWFORGE_TOKEN=${process.env.CLAWFORGE_TOKEN ?? ""}`,
            `PROGRAM_ID=${serverBot?.currentProgramId ?? opts.program ?? ""}`,
          ].join("\n") + "\n",
        );
        console.log(`Wrote .env for docker-compose`);

        // Setup gateway
        if (fs.existsSync(composePath)) {
          console.log(`Setting up openclaw gateway...`);
          run("docker compose  run --rm -it openclaw-gateway openclaw setup", { cwd: botDir });
        } else {
          console.log(
            `No docker-compose.yml found in bot dir — skipping container start`,
          );
        }
        // todo: call this
        // openclaw config set gateway.controlUi.allowInsecureAuth true

        // Merge yjs-plugin config into openclaw.json
        const openclawJsonPath = path.join(botDir, "openclaw", "openclaw.json");
        if (fs.existsSync(openclawJsonPath)) {
          const openclawConfig = JSON.parse(fs.readFileSync(openclawJsonPath, "utf8"));
          openclawConfig.plugins = {
            ...openclawConfig.plugins,
            load: {
              ...openclawConfig.plugins?.load,
              paths: [
                ...(openclawConfig.plugins?.load?.paths ?? []),
                "/opt/yjs-plugin",
              ],
            },
          };
          openclawConfig.channels = {
            ...openclawConfig.channels,
            yjs: {
              accounts: {
                default: { enabled: true },
              },
            },
          };
          fs.writeFileSync(openclawJsonPath, JSON.stringify(openclawConfig, null, 2) + "\n");
          console.log("Merged yjs-plugin config into openclaw.json");
        }

        // Start the gateway and yjs-server
        if (fs.existsSync(composePath)) {
          console.log(`Starting openclaw-gateway and yjs-server...`);
          run("docker compose up -d openclaw-gateway yjs-server", { cwd: botDir });
        } else {
          console.log(
            `No docker-compose.yml found in bot dir — skipping container start`,
          );
        }

        console.log(`\nBot started:`);
        console.log(`  ID:   ${botId}`);
        console.log(`  Name: ${botName}`);
      },
    );

  bot
    .command("stop")
    .description("Stop a running bot")
    .argument("<nameOrId>", "Bot name or ID")
    .action(async (nameOrId: string) => {
      const botDir = resolveBotDir(nameOrId);
      if (!botDir) {
        console.error(`Error: bot "${nameOrId}" not found in ${BOTS_DIR}/`);
        process.exit(1);
      }

      // Check if running
      const composePath = path.join(botDir, "docker-compose.yml");
      if (!fs.existsSync(composePath)) {
        console.log(`No docker-compose.yml in ${botDir} — nothing to stop`);
        return;
      }

      try {
        const ps = capture("docker compose ps --format json", {
          cwd: botDir,
        });
        if (ps.length > 0) {
          console.log(`Stopping containers in ${botDir}...`);
          run("docker compose down", { cwd: botDir });
          console.log(`Containers stopped`);
        } else {
          console.log(`No running containers found for bot "${nameOrId}"`);
        }
      } catch {
        console.log(`No running containers found for bot "${nameOrId}"`);
      }

      // Notify org server
      try {
        await stopBot(nameOrId);
      } catch {
        console.log(`Warning: could not notify server about bot stop.`);
      }
    });
}

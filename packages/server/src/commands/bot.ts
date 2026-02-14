import type { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { generateName } from "../lib/names.js";
import { detectPlatform } from "../lib/platform.js";
import { run, capture } from "../lib/exec.js";
import { botInfraDir } from "../lib/paths.js";
import {
  getTeam,
  getProgram,
  getProgramRole,
  getBotCredentials,
  stopBot,
} from "../lib/api.js";

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
    .requiredOption("--team <team>", "Team slug")
    .requiredOption("--program <program>", "Program slug")
    .requiredOption("--role <role>", "Role slug")
    .option("--name <name>", "Bot name (default: random fun name)")
    .action(
      async (opts: {
        team: string;
        program: string;
        role: string;
        name?: string;
      }) => {
        // Stub API calls
        await getTeam(opts.team);
        await getProgram(opts.program);
        await getProgramRole(opts.role);

        const botId = nanoid(12);
        const botName = opts.name ?? generateName();

        await getBotCredentials(botId);

        // Create directory structure
        const botDir = path.join(BOTS_DIR, botId);
        for (const sub of ["workspace", "openclaw", "tmp"]) {
          ensureDir(path.join(botDir, sub));
        }
        console.log(`Created bot directory: ${botDir}`);

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

        // Setup gateway
        // Start the gateway
        const composePath = path.join(botDir, "docker-compose.yml");
        if (fs.existsSync(composePath)) {
          console.log(`Setting up openclaw gateway...`);
          run("docker compose  run --rm -it openclaw-gateway openclaw setup", { cwd: botDir });
        } else {
          console.log(
            `No docker-compose.yml found in bot dir — skipping container start`,
          );
        }

        // Start the gateway
        if (fs.existsSync(composePath)) {
          console.log(`Starting openclaw-gateway...`);
          run("docker compose up -d openclaw-gateway", { cwd: botDir });
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
      await stopBot(nameOrId);
    });
}

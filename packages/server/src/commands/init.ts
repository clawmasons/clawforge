import type { Command } from "commander";
import { nanoid } from "nanoid";
import { configExists, writeConfig } from "../lib/config.js";
import { generateName } from "../lib/names.js";
import { registerBotServer } from "../lib/api.js";

export function registerInitCommand(program: Command) {
  program
    .command("init")
    .description("Initialize a new clawforge bot server")
    .option("--name <name>", "Server name (default: random fun name)")
    .action(async (opts: { name?: string }) => {
      if (configExists()) {
        console.error(
          "Error: clawforge.yaml already exists. This directory is already initialized.",
        );
        process.exit(1);
      }

      const id = nanoid(12);
      const name = opts.name ?? generateName();

      writeConfig({
        "bot-server": { id, name },
        "org-server": { host: "clawforge.org" },
      });

      console.log(`Created clawforge.yaml`);
      console.log(`  Server ID:   ${id}`);
      console.log(`  Server name: ${name}`);

      await registerBotServer(id, name);
    });
}

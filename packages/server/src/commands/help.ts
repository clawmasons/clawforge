import type { Command } from "commander";

export function registerHelpCommand(program: Command) {
  program
    .command("help")
    .description("Show help information")
    .action(() => {
      console.log(`
clawforge - Run clawforge clawbots locally

clawforge is used for running clawforge clawbots locally.
It can either use clawforge.org to manage the bots, or you can run clawforge locally.

Dependencies:
  - Docker
  - CLAWFORGE_TOKEN - log in to clawforge to fetch
  
Usage:
  clawforge <command> [options]

Run 'clawforge <command> --help' for more information on a command.
`.trim());
    });
}

import { Command } from "commander";
import { registerHelpCommand } from "./commands/help.js";
import { registerInitCommand } from "./commands/init.js";
import { registerBotCommand } from "./commands/bot.js";

const program = new Command();

program.name("clawforge").version("0.0.1").description("Clawforge CLI");

registerHelpCommand(program);
registerInitCommand(program);
registerBotCommand(program);

await program.parseAsync();

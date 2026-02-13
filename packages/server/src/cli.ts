#!/usr/bin/env node
import { Command } from "commander";
import { registerHelpCommand } from "./commands/help.js";

const program = new Command();

program.name("clawforge").version("0.0.1").description("Clawforge CLI");

registerHelpCommand(program);

program.parse();

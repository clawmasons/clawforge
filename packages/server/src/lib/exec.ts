import { execSync } from "node:child_process";

export interface ExecOptions {
  cwd?: string;
}

/** Run a command, inheriting stdio (output goes to terminal) */
export function run(cmd: string, opts: ExecOptions = {}): void {
  execSync(cmd, { stdio: "inherit", cwd: opts.cwd });
}

/** Run a command and capture stdout as a trimmed string */
export function capture(cmd: string, opts: ExecOptions = {}): string {
  return execSync(cmd, { cwd: opts.cwd, encoding: "utf-8" }).trim();
}

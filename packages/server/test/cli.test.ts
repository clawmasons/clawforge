import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { parse } from "yaml";

const CLI_PATH = path.resolve(
  import.meta.dirname,
  "..",
  "src",
  "cli.ts",
);

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runCli(args: string, cwd: string): RunResult {
  try {
    const stdout = execSync(`npx tsx "${CLI_PATH}" ${args}`, {
      cwd,
      encoding: "utf-8",
      stderr: "pipe",
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.status ?? 1,
    };
  }
}

let tmpDir: string;

function makeTmpDir(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawforge-test-"));
  return tmpDir;
}

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── clawforge init ──────────────────────────────────────────────

describe("clawforge init", () => {
  it("creates clawforge.yaml with correct structure", () => {
    const dir = makeTmpDir();
    const result = runCli("init --name test-server", dir);
    assert.equal(result.exitCode, 0);

    const configPath = path.join(dir, "clawforge.yaml");
    assert.ok(fs.existsSync(configPath), "clawforge.yaml should exist");

    const config = parse(fs.readFileSync(configPath, "utf-8"));
    assert.ok(config["bot-server"], "should have bot-server section");
    assert.equal(config["bot-server"].name, "test-server");
    assert.equal(typeof config["bot-server"].id, "string");
    assert.equal(config["bot-server"].id.length, 12);
    assert.equal(config["org-server"].host, "clawforge.org");
  });

  it("respects --name flag", () => {
    const dir = makeTmpDir();
    runCli("init --name my-custom-name", dir);

    const config = parse(
      fs.readFileSync(path.join(dir, "clawforge.yaml"), "utf-8"),
    );
    assert.equal(config["bot-server"].name, "my-custom-name");
  });

  it("generates a random name when --name omitted", () => {
    const dir = makeTmpDir();
    runCli("init", dir);

    const config = parse(
      fs.readFileSync(path.join(dir, "clawforge.yaml"), "utf-8"),
    );
    const name = config["bot-server"].name;
    assert.ok(name, "name should be present");
    assert.match(name, /^[a-z]+-[a-z]+$/, "name should be adjective-animal");
  });

  it("errors if clawforge.yaml already exists", () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, "clawforge.yaml"), "existing: true\n");

    const result = runCli("init --name test", dir);
    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stderr.includes("already exists"),
      "should mention already exists",
    );
  });
});

// ─── clawforge bot start ─────────────────────────────────────────

describe("clawforge bot start", () => {
  it("creates bot directory with workspace, openclaw, tmp subdirs", () => {
    const dir = makeTmpDir();
    const result = runCli(
      "bot start --team t --program p --role r --name test-bot",
      dir,
    );
    assert.equal(result.exitCode, 0);

    const botsDir = path.join(dir, "bots");
    assert.ok(fs.existsSync(botsDir), "bots/ should exist");

    // Find the ID directory (not the symlink)
    const entries = fs.readdirSync(botsDir, { withFileTypes: true });
    const idEntry = entries.find(
      (e) => e.isDirectory() && e.name !== "test-bot",
    );
    assert.ok(idEntry, "should have an ID directory");

    const botDir = path.join(botsDir, idEntry!.name);
    for (const sub of ["workspace", "openclaw", "tmp"]) {
      assert.ok(
        fs.existsSync(path.join(botDir, sub)),
        `${sub}/ should exist`,
      );
    }
  });

  it("creates name symlink pointing to ID directory", () => {
    const dir = makeTmpDir();
    runCli("bot start --team t --program p --role r --name my-bot", dir);

    const symlinkPath = path.join(dir, "bots", "my-bot");
    assert.ok(fs.existsSync(symlinkPath), "symlink should exist");

    const stat = fs.lstatSync(symlinkPath);
    assert.ok(stat.isSymbolicLink(), "should be a symlink");

    const target = fs.readlinkSync(symlinkPath);
    assert.equal(target.length, 12, "symlink target should be a nanoid (12 chars)");
  });

  it("respects --name flag", () => {
    const dir = makeTmpDir();
    runCli(
      "bot start --team t --program p --role r --name custom-name",
      dir,
    );

    assert.ok(
      fs.existsSync(path.join(dir, "bots", "custom-name")),
      "symlink with custom name should exist",
    );
  });

  it("generates random name when --name omitted", () => {
    const dir = makeTmpDir();
    const result = runCli("bot start --team t --program p --role r", dir);
    assert.equal(result.exitCode, 0);

    // stdout should contain the bot name in "Name: <name>" format
    const nameMatch = result.stdout.match(/Name:\s+(\S+)/);
    assert.ok(nameMatch, "should print bot name");
    assert.match(
      nameMatch![1],
      /^[a-z]+-[a-z]+$/,
      "name should be adjective-animal",
    );

    // The symlink with that name should exist
    assert.ok(
      fs.existsSync(path.join(dir, "bots", nameMatch![1])),
      "symlink with generated name should exist",
    );
  });
});

// ─── clawforge bot stop ──────────────────────────────────────────

describe("clawforge bot stop", () => {
  it("errors when bot not found", () => {
    const dir = makeTmpDir();
    fs.mkdirSync(path.join(dir, "bots"), { recursive: true });

    const result = runCli("bot stop nonexistent", dir);
    assert.equal(result.exitCode, 1);
    assert.ok(
      result.stderr.includes("not found"),
      "should mention not found",
    );
  });

  it("handles bot with no docker-compose.yml gracefully", () => {
    const dir = makeTmpDir();
    const botDir = path.join(dir, "bots", "test-bot-id");
    fs.mkdirSync(botDir, { recursive: true });

    const result = runCli("bot stop test-bot-id", dir);
    assert.equal(result.exitCode, 0);
    assert.ok(
      result.stdout.includes("nothing to stop"),
      "should mention nothing to stop",
    );
  });

  it("resolves name symlinks to the ID directory", () => {
    const dir = makeTmpDir();
    const botId = "abc123def456";
    const botDir = path.join(dir, "bots", botId);
    fs.mkdirSync(botDir, { recursive: true });
    fs.symlinkSync(botId, path.join(dir, "bots", "my-bot"));

    const result = runCli("bot stop my-bot", dir);
    assert.equal(result.exitCode, 0);
    assert.ok(
      result.stdout.includes("nothing to stop"),
      "should resolve symlink and handle gracefully",
    );
  });
});

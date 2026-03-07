import { readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { Command } from "commander";
import {
  normalizeError,
  printError,
  isCommanderHelpExit,
} from "../../../lib/cli-utils.js";

// Import all register functions
import { register as registerPageCommands } from "../../../commands/page.js";
import { register as registerWorkspaceCommands } from "../../../commands/workspace.js";
import { register as registerInviteCommands } from "../../../commands/invite.js";
import { register as registerUserCommands } from "../../../commands/user.js";
import { register as registerSpaceCommands } from "../../../commands/space.js";
import { register as registerGroupCommands } from "../../../commands/group.js";
import { register as registerCommentCommands } from "../../../commands/comment.js";
import { register as registerShareCommands } from "../../../commands/share.js";
import { register as registerFileCommands } from "../../../commands/file.js";
import { register as registerSearchCommands } from "../../../commands/search.js";
import { register as registerDiscoveryCommands } from "../../../commands/discovery.js";

export type CliResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

function buildProgram(): Command {
  const program = new Command()
    .name("docmost")
    .exitOverride()
    .configureOutput({
      writeOut: () => {},
      writeErr: () => {},
    });

  // Global options matching src/index.ts
  program
    .option("-u, --api-url <url>", "Docmost API URL")
    .option("-e, --email <email>", "Docmost account email")
    .option("--password <password>", "Docmost account password")
    .option("-t, --token <token>", "Docmost API auth token")
    .option("-f, --format <format>", "Output format: json | table | text", "json")
    .option("-q, --quiet", "Suppress output, exit code only")
    .option("--limit <n>", "Items per API page (1-100)")
    .option("--max-items <n>", "Stop after N total items");

  registerPageCommands(program);
  registerWorkspaceCommands(program);
  registerInviteCommands(program);
  registerUserCommands(program);
  registerSpaceCommands(program);
  registerGroupCommands(program);
  registerCommentCommands(program);
  registerShareCommands(program);
  registerFileCommands(program);
  registerSearchCommands(program);
  registerDiscoveryCommands(program);

  return program;
}

/**
 * Run a CLI command programmatically and capture output.
 *
 * @param args - CLI arguments (e.g., ["page-list", "--space-id", "abc"])
 * @param env  - Extra env vars for this invocation
 */
export async function runCli(
  args: string[],
  env: Record<string, string> = {},
): Promise<CliResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];

  // Save and override env
  const savedEnv: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }

  // Intercept console
  const origLog = console.log;
  const origError = console.error;
  const origTable = console.table;
  const origStdoutWrite = process.stdout.write;
  const origStderrWrite = process.stderr.write;

  console.log = (...a: unknown[]) => stdout.push(a.map(String).join(" "));
  console.error = (...a: unknown[]) => stderr.push(a.map(String).join(" "));
  console.table = (...a: unknown[]) => stdout.push(JSON.stringify(a));
  process.stdout.write = ((chunk: string) => {
    stdout.push(chunk);
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string) => {
    stderr.push(chunk);
    return true;
  }) as typeof process.stderr.write;

  let exitCode = 0;

  try {
    const program = buildProgram();
    await program.parseAsync(["node", "docmost", ...args]);
  } catch (error: unknown) {
    if (isCommanderHelpExit(error)) {
      exitCode = 0;
    } else {
      // Mirror src/index.ts error handling: normalize + print envelope
      const normalized = normalizeError(error);
      printError(normalized, "json");
      exitCode = normalized.exitCode;
    }
  } finally {
    // Restore
    console.log = origLog;
    console.error = origError;
    console.table = origTable;
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  return {
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
    exitCode,
  };
}

/** Parse JSON envelope from stdout (success) or stderr (error) */
export function parseEnvelope(result: CliResult) {
  const source = result.stdout.trim() || result.stderr.trim();
  return JSON.parse(source);
}

/** Get test server URL from env */
export function testUrl(): string {
  return process.env.DOCMOST_TEST_URL || "http://localhost:4010/api";
}

/** Must match TOKEN_FILE in global-setup.ts (duplicated to avoid ESM import issues) */
const TOKEN_FILE = join(tmpdir(), "docmost-test-token");

/** Read token written by global-setup (runs in a separate process) */
function readTestToken(): string {
  try {
    return readFileSync(TOKEN_FILE, "utf-8").trim();
  } catch {
    return process.env.DOCMOST_TEST_TOKEN || "";
  }
}

/** Get test credentials env vars for runCli */
export function testEnv(): Record<string, string> {
  return {
    DOCMOST_API_URL: testUrl(),
    DOCMOST_TOKEN: readTestToken(),
    DOCMOST_EMAIL: process.env.DOCMOST_TEST_EMAIL || "",
    DOCMOST_PASSWORD: process.env.DOCMOST_TEST_PASSWORD || "",
  };
}

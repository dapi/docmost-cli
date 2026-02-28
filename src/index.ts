#!/usr/bin/env node
import { readFileSync } from "fs";
import { Command } from "commander";
import {
  isCommanderHelpExit,
  getSafeOutput,
  normalizeError,
  printError,
} from "./lib/cli-utils.js";
import { register as registerPageCommands } from "./commands/page.js";
import { register as registerWorkspaceCommands } from "./commands/workspace.js";
import { register as registerInviteCommands } from "./commands/invite.js";
import { register as registerUserCommands } from "./commands/user.js";
import { register as registerSpaceCommands } from "./commands/space.js";
import { register as registerGroupCommands } from "./commands/group.js";
import { register as registerCommentCommands } from "./commands/comment.js";
import { register as registerShareCommands } from "./commands/share.js";
import { register as registerFileCommands } from "./commands/file.js";
import { register as registerSearchCommands } from "./commands/search.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

async function main() {
  const program = new Command()
    .name("docmost")
    .description("Agent-first CLI for Docmost documentation platform")
    .version(pkg.version)
    .showHelpAfterError()
    .option("-u, --api-url <url>", "Docmost API URL")
    .option("-e, --email <email>", "Docmost account email")
    .option("--password <password>", "Docmost account password (prefer DOCMOST_PASSWORD env var)")
    .option("-t, --token <token>", "Docmost API auth token")
    .option("-f, --format <format>", "Output format: json | table | text", "json")
    .option("-q, --quiet", "Suppress output, exit code only")
    .option("--limit <n>", "Items per API page (1-100)")
    .option("--max-items <n>", "Stop after N total items")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  docmost workspace-info",
        "  docmost page-list --space-id <space-id> --format table",
        "  docmost page-info --page-id <page-id> --format text",
        "  docmost search --query \"onboarding\"",
        "  docmost space-list --format table",
        "",
        "Auth precedence:",
        "  1) --token, then DOCMOST_TOKEN",
        "  2) --email/--password, then DOCMOST_EMAIL/DOCMOST_PASSWORD",
        "",
        "Security: CLI flags are visible in process lists. Use env vars for credentials.",
      ].join("\n"),
    )
    .exitOverride();

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

  try {
    await program.parseAsync(process.argv);
  } catch (error: unknown) {
    if (isCommanderHelpExit(error)) {
      process.exit(0);
    }

    const output = getSafeOutput(program);
    const normalized = normalizeError(error);
    printError(normalized, output);
    process.exit(normalized.exitCode);
  }
}

main();

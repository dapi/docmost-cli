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

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

async function main() {
  const program = new Command()
    .name("docmost")
    .description("CLI for Docmost documentation platform")
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
        "  docmost --api-url http://localhost:3000/api --token <token> workspace-info",
        "  DOCMOST_PASSWORD=secret docmost --api-url http://localhost:3000/api --email admin@example.com search --query \"onboarding\"",
        "  docmost page-list --space-id <space-id> --format table",
        "  docmost page-info --page-id <page-id> --format text",
        "",
        "Auth precedence:",
        "  1) --token, then DOCMOST_TOKEN",
        "  2) --email/--password, then DOCMOST_EMAIL/DOCMOST_PASSWORD",
        "",
        "Security: CLI flags are visible in process lists. Use env vars for credentials.",
      ].join("\n"),
    )
    .exitOverride();

  // Hidden alias: keep -o/--output working during transition
  program.option("-o, --output <format>", undefined);
  (program.options.find((o: any) => o.long === "--output") as any).hidden = true;

  registerPageCommands(program);
  registerWorkspaceCommands(program);

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

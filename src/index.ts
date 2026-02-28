#!/usr/bin/env node
import { readFileSync } from "fs";
import { Command } from "commander";
import {
  type OutputFormat,
  type GlobalOptions,
  type ResolvedOptions,
  CliError,
  ensureOutputSupported,
  printResult,
  resolveContentInput,
  parsePageIds,
  withClient,
  isCommanderHelpExit,
  getSafeOutput,
  normalizeError,
  printError,
} from "./lib/cli-utils.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };

function registerCommands(program: Command) {
  program
    .command("workspace")
    .description("Get the current Docmost workspace")
    .action(() =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output, { allowTable: true });
        const result = await client.getWorkspace();
        printResult(result, opts.output, { allowTable: true });
      }),
    );

  program
    .command("list-spaces")
    .description("List all available spaces")
    .action(() =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output, { allowTable: true });
        const result = await client.getSpaces();
        printResult(result, opts.output, { allowTable: true });
      }),
    );

  program
    .command("list-groups")
    .description("List all available groups")
    .action(() =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output, { allowTable: true });
        const result = await client.getGroups();
        printResult(result, opts.output, { allowTable: true });
      }),
    );

  program
    .command("list-pages")
    .description("List pages")
    .option("-s, --space-id <id>", "Filter by space ID")
    .action((options: { spaceId?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output, { allowTable: true });
        const result = await client.listPages(options.spaceId);
        printResult(result, opts.output, { allowTable: true });
      }),
    );

  program
    .command("get-page")
    .description("Get page by ID")
    .requiredOption("--page-id <id>", "Page ID")
    .action((options: { pageId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output, { allowTable: true, allowText: true });
        const result = await client.getPage(options.pageId);
        printResult(result, opts.output, {
          allowTable: true,
          textExtractor: (data) => {
            const value = data as { data?: { content?: string } };
            return value.data?.content;
          },
        });
      }),
    );

  program
    .command("create-page")
    .description("Create a new page")
    .requiredOption("--title <title>", "Page title")
    .requiredOption("--content <content>", "Content literal, @file, or - for stdin")
    .requiredOption("--space-id <id>", "Space ID")
    .option("--parent-page-id <id>", "Parent page ID")
    .action(
      (options: {
        title: string;
        content: string;
        spaceId: string;
        parentPageId?: string;
      }) =>
        withClient(program, async (client, opts) => {
          ensureOutputSupported(opts.output);
          const content = await resolveContentInput(options.content);
          const result = await client.createPage(
            options.title,
            content,
            options.spaceId,
            options.parentPageId,
          );
          printResult(result, opts.output);
        }),
    );

  program
    .command("update-page")
    .description("Update page content and optional title")
    .requiredOption("--page-id <id>", "Page ID")
    .requiredOption("--content <content>", "Content literal, @file, or - for stdin")
    .option("--title <title>", "New page title")
    .action((options: { pageId: string; content: string; title?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output);
        const content = await resolveContentInput(options.content);
        const result = await client.updatePage(options.pageId, content, options.title);
        printResult(result, opts.output);
      }),
    );

  program
    .command("move-page")
    .description("Move page to a different parent or to root")
    .requiredOption("--page-id <id>", "Page ID")
    .option("--parent-page-id <id>", "Target parent page ID")
    .option("--position <pos>", "Position string (5-12 chars)")
    .option("--root", "Move page to root")
    .action(
      (options: {
        pageId: string;
        parentPageId?: string;
        position?: string;
        root?: boolean;
      }) =>
        withClient(program, async (client, opts) => {
          ensureOutputSupported(opts.output);
          if (options.root && options.parentPageId) {
            throw new CliError(
              "VALIDATION_ERROR",
              "--root and --parent-page-id are mutually exclusive.",
            );
          }
          if (!options.root && !options.parentPageId) {
            throw new CliError(
              "VALIDATION_ERROR",
              "Specify --parent-page-id <id> or --root.",
            );
          }

          const parentPageId = options.root ? null : (options.parentPageId ?? null);
          const result = await client.movePage(
            options.pageId,
            parentPageId,
            options.position,
          );
          printResult(result, opts.output);
        }),
    );

  program
    .command("delete-page")
    .description("Delete a page")
    .requiredOption("--page-id <id>", "Page ID")
    .option("--permanent", "Permanently delete page (no trash)")
    .action((options: { pageId: string; permanent?: boolean }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output);
        const result = await client.deletePage(options.pageId, options.permanent);
        printResult(result, opts.output);
      }),
    );

  program
    .command("delete-pages")
    .description("Delete multiple pages")
    .requiredOption("--page-ids <id1,id2,...>", "Comma-separated page IDs")
    .action((options: { pageIds: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output, { allowTable: true });
        const pageIds = parsePageIds(options.pageIds);
        const result = await client.deletePages(pageIds);
        printResult(result, opts.output, { allowTable: true });
        const failed = result.filter((r) => !r.success);
        if (failed.length > 0) {
          throw new CliError(
            "INTERNAL_ERROR",
            `Failed to delete ${failed.length} of ${result.length} pages.`,
          );
        }
      }),
    );

  program
    .command("search")
    .description("Search pages and content")
    .argument("<query>", "Search query")
    .option("-s, --space-id <id>", "Filter by space ID")
    .action((query: string, options: { spaceId?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output, { allowTable: true });
        const result = await client.search(query, options.spaceId);
        printResult(result, opts.output, { allowTable: true });
      }),
    );

  program
    .command("page-history")
    .description("Get page version history")
    .requiredOption("--page-id <id>", "Page ID")
    .option("--cursor <cursor>", "Pagination cursor")
    .action((options: { pageId: string; cursor?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output, { allowTable: true });
        const result = await client.getPageHistory(options.pageId, options.cursor);
        printResult(result, opts.output, { allowTable: true });
      }),
    );

  program
    .command("page-history-detail")
    .description("Get specific page history entry")
    .requiredOption("--history-id <id>", "History entry ID")
    .action((options: { historyId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output, { allowTable: true, allowText: true });
        const result = await client.getPageHistoryDetail(options.historyId);
        printResult(result, opts.output, {
          allowTable: true,
          textExtractor: (data) => {
            const value = data as { content?: string };
            return value.content;
          },
        });
      }),
    );

  program
    .command("restore-page")
    .description("Restore page from trash")
    .requiredOption("--page-id <id>", "Page ID")
    .action((options: { pageId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output);
        const result = await client.restorePage(options.pageId);
        printResult(result, opts.output);
      }),
    );

  program
    .command("trash")
    .description("List deleted pages in a space")
    .requiredOption("--space-id <id>", "Space ID")
    .action((options: { spaceId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output, { allowTable: true });
        const result = await client.getTrash(options.spaceId);
        printResult(result, opts.output, { allowTable: true });
      }),
    );

  program
    .command("duplicate-page")
    .description("Duplicate page")
    .requiredOption("--page-id <id>", "Page ID")
    .option("--space-id <id>", "Target space ID")
    .action((options: { pageId: string; spaceId?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output);
        const result = await client.duplicatePage(options.pageId, options.spaceId);
        printResult(result, opts.output);
      }),
    );

  program
    .command("breadcrumbs")
    .description("Get breadcrumb path for page")
    .requiredOption("--page-id <id>", "Page ID")
    .action((options: { pageId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts.output, { allowTable: true });
        const result = await client.getPageBreadcrumbs(options.pageId);
        printResult(result, opts.output, { allowTable: true });
      }),
    );
}

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
        "  docmost --api-url http://localhost:3000/api --token <token> workspace",
        "  DOCMOST_PASSWORD=secret docmost --api-url http://localhost:3000/api --email admin@example.com search \"onboarding\"",
        "  docmost list-pages --space-id <space-id> --format table",
        "  docmost get-page --page-id <page-id> --format text",
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

  registerCommands(program);

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

import { writeFileSync } from "fs";
import { Command, Option } from "commander";
import {
  type ResolvedOptions,
  CliError,
  ensureOutputSupported,
  printResult,
  resolveContentInput,
  parseCommaSeparatedIds,
  withClient,
} from "../lib/cli-utils.js";

export function register(program: Command) {
  program
    .command("page-list")
    .description("List pages")
    .option("-s, --space-id <id>", "Filter by space ID")
    .action((options: { spaceId?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.listPages(options.spaceId);
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("page-info")
    .description("Get page by ID")
    .requiredOption("--page-id <id>", "Page ID")
    .action((options: { pageId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true, allowText: true });
        const result = await client.getPage(options.pageId);
        printResult(result, opts, {
          allowTable: true,
          textExtractor: (data) => {
            const value = data as { data?: { content?: string } };
            return value.data?.content;
          },
        });
      }),
    );

  program
    .command("page-create")
    .description("Create a new page")
    .requiredOption("--space-id <id>", "Space ID")
    .option("--title <title>", "Page title")
    .option("--icon <icon>", "Page icon")
    .option("--parent-page-id <id>", "Parent page ID")
    .action(
      (options: {
        spaceId: string;
        title?: string;
        icon?: string;
        parentPageId?: string;
      }) =>
        withClient(program, async (client, opts) => {
          ensureOutputSupported(opts);
          const result = await client.createPage(
            options.spaceId,
            options.title,
            options.icon,
            options.parentPageId,
          );
          printResult(result, opts);
        }),
    );

  program
    .command("page-update")
    .description("Update page metadata and/or content")
    .requiredOption("--page-id <id>", "Page ID")
    .option("--content <content>", "Content literal, @file, or - for stdin")
    .option("--title <title>", "New page title")
    .option("--icon <icon>", "Page icon")
    .action((options: { pageId: string; content?: string; title?: string; icon?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        if (!options.content && !options.title && options.icon === undefined) {
          throw new CliError("VALIDATION_ERROR", "Provide at least one of --content, --title, or --icon.");
        }
        const content = options.content ? await resolveContentInput(options.content) : undefined;
        const result = await client.updatePage(options.pageId, content, options.title, options.icon);
        printResult(result, opts);
      }),
    );

  program
    .command("page-move")
    .description("Move page to a different parent or to root")
    .requiredOption("--page-id <id>", "Page ID")
    .option("--parent-page-id <id>", "Target parent page ID")
    .option("--position <pos>", "Position string", "a00000")
    .option("--root", "Move page to root")
    .action(
      (options: {
        pageId: string;
        parentPageId?: string;
        position?: string;
        root?: boolean;
      }) =>
        withClient(program, async (client, opts) => {
          ensureOutputSupported(opts);
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
          printResult(result, opts);
        }),
    );

  program
    .command("page-delete")
    .description("Delete a page")
    .requiredOption("--page-id <id>", "Page ID")
    .option("--permanently-delete", "Permanently delete page (no trash)")
    .action((options: { pageId: string; permanentlyDelete?: boolean }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.deletePage(options.pageId, options.permanentlyDelete);
        printResult(result, opts);
      }),
    );

  program
    .command("page-delete-bulk")
    .description("Delete multiple pages")
    .requiredOption("--page-ids <id1,id2,...>", "Comma-separated page IDs")
    .action((options: { pageIds: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const pageIds = parseCommaSeparatedIds("--page-ids", options.pageIds);
        const result = await client.deletePages(pageIds);
        printResult(result, opts, { allowTable: true });
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
    .command("page-history")
    .description("Get page version history")
    .requiredOption("--page-id <id>", "Page ID")
    .action((options: { pageId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getPageHistory(options.pageId, opts.limit, opts.maxItems);
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("page-history-detail")
    .description("Get specific page history entry")
    .requiredOption("--history-id <id>", "History entry ID")
    .action((options: { historyId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true, allowText: true });
        const result = await client.getPageHistoryDetail(options.historyId);
        printResult(result, opts, {
          allowTable: true,
          textExtractor: (data) => {
            const value = data as { content?: string };
            return value.content;
          },
        });
      }),
    );

  program
    .command("page-restore")
    .description("Restore page from trash")
    .requiredOption("--page-id <id>", "Page ID")
    .action((options: { pageId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.restorePage(options.pageId);
        printResult(result, opts);
      }),
    );

  program
    .command("page-trash")
    .description("List deleted pages in a space")
    .requiredOption("--space-id <id>", "Space ID")
    .action((options: { spaceId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getTrash(options.spaceId);
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("page-duplicate")
    .description("Duplicate page")
    .requiredOption("--page-id <id>", "Page ID")
    .option("--space-id <id>", "Target space ID")
    .action((options: { pageId: string; spaceId?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.duplicatePage(options.pageId, options.spaceId);
        printResult(result, opts);
      }),
    );

  program
    .command("page-breadcrumbs")
    .description("Get breadcrumb path for page")
    .requiredOption("--page-id <id>", "Page ID")
    .action((options: { pageId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getPageBreadcrumbs(options.pageId);
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("page-tree")
    .description("Get page tree for a space or page")
    .option("-s, --space-id <id>", "Space ID")
    .option("--page-id <id>", "Page ID")
    .action((options: { spaceId?: string; pageId?: string }) =>
      withClient(program, async (client, opts) => {
        if (!options.spaceId && !options.pageId) {
          throw new CliError(
            "VALIDATION_ERROR",
            "At least one of --space-id or --page-id is required.",
          );
        }
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getPageTree(options.spaceId, options.pageId);
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("page-move-to-space")
    .description("Move page to a different space")
    .requiredOption("--page-id <id>", "Page ID")
    .requiredOption("--space-id <id>", "Target space ID")
    .action((options: { pageId: string; spaceId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.movePageToSpace(options.pageId, options.spaceId);
        printResult(result, opts);
      }),
    );

  program
    .command("page-export")
    .description("Export page content")
    .requiredOption("--page-id <id>", "Page ID")
    .addOption(
      new Option("--export-format <format>", "Export format").choices(["html", "markdown"]).makeOptionMandatory(),
    )
    .option("--output <path>", "Output file path")
    .option("--include-children", "Include child pages")
    .option("--include-attachments", "Include attachments")
    .action(
      (options: {
        pageId: string;
        exportFormat: string;
        output?: string;
        includeChildren?: boolean;
        includeAttachments?: boolean;
      }) =>
        withClient(program, async (client) => {
          const data = await client.exportPage(
            options.pageId,
            options.exportFormat,
            options.includeChildren,
            options.includeAttachments,
          );
          if (options.output) {
            writeFileSync(options.output, Buffer.from(data));
          } else {
            process.stdout.write(Buffer.from(data));
          }
        }),
    );

  program
    .command("page-import")
    .description("Import a page from file")
    .requiredOption("--file <path>", "File to import")
    .requiredOption("--space-id <id>", "Space ID")
    .action((options: { file: string; spaceId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.importPage(options.file, options.spaceId);
        printResult(result, opts);
      }),
    );

  program
    .command("page-import-zip")
    .description("Import pages from a zip archive")
    .requiredOption("--file <path>", "Zip file to import")
    .requiredOption("--space-id <id>", "Space ID")
    .addOption(
      new Option("--source <source>", "Import source").choices(["generic", "notion", "confluence"]).makeOptionMandatory(),
    )
    .action((options: { file: string; spaceId: string; source: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.importZip(options.file, options.spaceId, options.source);
        printResult(result, opts);
      }),
    );
}

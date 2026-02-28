import { Command, Option } from "commander";
import {
  ensureOutputSupported,
  printResult,
  withClient,
} from "../lib/cli-utils.js";

export function register(program: Command) {
  program
    .command("share-list")
    .description("List all shares")
    .action(() =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getShares();
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("share-info")
    .description("Get share details")
    .requiredOption("--share-id <id>", "Share ID")
    .action((options: { shareId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.getShareInfo(options.shareId);
        printResult(result, opts);
      }),
    );

  program
    .command("share-for-page")
    .description("Get share for a page")
    .requiredOption("--page-id <id>", "Page ID")
    .action((options: { pageId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.getShareForPage(options.pageId);
        printResult(result, opts);
      }),
    );

  program
    .command("share-create")
    .description("Create a share for a page")
    .requiredOption("--page-id <id>", "Page ID")
    .addOption(new Option("--include-subpages <bool>", "Include subpages").choices(["true", "false"]))
    .addOption(new Option("--search-indexing <bool>", "Allow search indexing").choices(["true", "false"]))
    .action((options: { pageId: string; includeSubpages?: string; searchIndexing?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const includeSubPages = options.includeSubpages !== undefined ? options.includeSubpages === "true" : undefined;
        const searchIndexing = options.searchIndexing !== undefined ? options.searchIndexing === "true" : undefined;
        const result = await client.createShare(options.pageId, includeSubPages, searchIndexing);
        printResult(result, opts);
      }),
    );

  program
    .command("share-update")
    .description("Update a share")
    .requiredOption("--share-id <id>", "Share ID")
    .addOption(new Option("--include-subpages <bool>", "Include subpages").choices(["true", "false"]))
    .addOption(new Option("--search-indexing <bool>", "Allow search indexing").choices(["true", "false"]))
    .action((options: { shareId: string; includeSubpages?: string; searchIndexing?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const includeSubPages = options.includeSubpages !== undefined ? options.includeSubpages === "true" : undefined;
        const searchIndexing = options.searchIndexing !== undefined ? options.searchIndexing === "true" : undefined;
        const result = await client.updateShare(options.shareId, includeSubPages, searchIndexing);
        printResult(result, opts);
      }),
    );

  program
    .command("share-delete")
    .description("Delete a share")
    .requiredOption("--share-id <id>", "Share ID")
    .action((options: { shareId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.deleteShare(options.shareId);
        printResult(result, opts);
      }),
    );
}

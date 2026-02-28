import { Command } from "commander";
import {
  ensureOutputSupported,
  printResult,
  withClient,
} from "../lib/cli-utils.js";

export function register(program: Command) {
  program
    .command("search")
    .description("Search pages and content")
    .requiredOption("--query <q>", "Search query")
    .option("-s, --space-id <id>", "Filter by space ID")
    .option("--creator-id <id>", "Filter by creator ID")
    .action((options: { query: string; spaceId?: string; creatorId?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.search(options.query, options.spaceId, options.creatorId);
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("search-suggest")
    .description("Get search suggestions")
    .requiredOption("--query <q>", "Search query")
    .option("-s, --space-id <id>", "Filter by space ID")
    .option("--include-users", "Include users in results")
    .option("--include-groups", "Include groups in results")
    .option("--include-pages", "Include pages in results")
    .option("--max-results <n>", "Max results", parseInt)
    .action(
      (options: {
        query: string;
        spaceId?: string;
        includeUsers?: boolean;
        includeGroups?: boolean;
        includePages?: boolean;
        maxResults?: number;
      }) =>
        withClient(program, async (client, opts) => {
          ensureOutputSupported(opts, { allowTable: true });
          const result = await client.searchSuggest(options.query, options.spaceId, {
            includeUsers: options.includeUsers,
            includeGroups: options.includeGroups,
            includePages: options.includePages,
            limit: options.maxResults,
          });
          printResult(result, opts, { allowTable: true });
        }),
    );
}

#!/usr/bin/env node
import { readFileSync } from "fs";
import { readFile } from "fs/promises";
import axios from "axios";
import { Command, CommanderError } from "commander";
import { DocmostClient, type ClientAuthOptions } from "./client.js";

type OutputFormat = "json" | "table" | "text";

type GlobalOptions = {
  apiUrl?: string;
  email?: string;
  password?: string;
  token?: string;
  output?: string;
};

type ResolvedOptions = {
  apiUrl: string;
  output: OutputFormat;
  auth: ClientAuthOptions;
};

type CliErrorCode =
  | "AUTH_ERROR"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "INTERNAL_ERROR";

const EXIT_CODES: Record<CliErrorCode, number> = {
  AUTH_ERROR: 2,
  NOT_FOUND: 3,
  VALIDATION_ERROR: 4,
  NETWORK_ERROR: 5,
  INTERNAL_ERROR: 1,
};

class CliError extends Error {
  readonly code: CliErrorCode;
  readonly exitCode: number;
  readonly details?: unknown;

  constructor(code: CliErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.exitCode = EXIT_CODES[code];
    this.details = details;
  }
}

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { version: string };


function normalizeOutputFormat(value: string | undefined): OutputFormat {
  const normalized = (value || "json").toLowerCase();
  if (normalized === "json" || normalized === "table" || normalized === "text") {
    return normalized;
  }
  throw new CliError(
    "VALIDATION_ERROR",
    `Unsupported output format '${value}'. Use json, table, or text.`,
  );
}

function resolveOptions(raw: GlobalOptions): ResolvedOptions {
  const apiUrl = raw.apiUrl || process.env.DOCMOST_API_URL;
  const token = raw.token || process.env.DOCMOST_TOKEN;
  const email = raw.email || process.env.DOCMOST_EMAIL;
  const password = raw.password || process.env.DOCMOST_PASSWORD;

  if (!apiUrl) {
    throw new CliError(
      "VALIDATION_ERROR",
      "API URL is required. Use --api-url or DOCMOST_API_URL.",
    );
  }

  if (!token && (!email || !password)) {
    throw new CliError(
      "VALIDATION_ERROR",
      "Authentication is required: provide --token (or DOCMOST_TOKEN) or both --email/--password (or DOCMOST_EMAIL/DOCMOST_PASSWORD).",
    );
  }

  return {
    apiUrl,
    output: normalizeOutputFormat(raw.output),
    auth: token ? { token } : { email: email!, password: password! },
  };
}

function flattenForTable(row: unknown): Record<string, unknown> {
  if (row === null || typeof row !== "object") {
    return { value: row };
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      output[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      const allPrimitive = value.every(
        (item) =>
          item === null ||
          typeof item === "string" ||
          typeof item === "number" ||
          typeof item === "boolean",
      );
      output[key] = allPrimitive ? value.join(", ") : JSON.stringify(value);
      continue;
    }

    output[key] = JSON.stringify(value);
  }

  return output;
}

function toTableRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.map((row) => flattenForTable(row));
  }

  if (data && typeof data === "object") {
    const value = data as Record<string, unknown>;
    if (Array.isArray(value.items)) {
      return value.items.map((row) => flattenForTable(row));
    }
    if (value.data && typeof value.data === "object") {
      const inner = value.data as Record<string, unknown>;
      if (Array.isArray(inner.items)) {
        return inner.items.map((row) => flattenForTable(row));
      }
    }
  }

  return [flattenForTable(data)];
}

function printResult(
  data: unknown,
  output: OutputFormat,
  options: {
    allowTable?: boolean;
    textExtractor?: (result: unknown) => string | undefined;
  } = {},
) {
  if (output === "json") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (output === "table") {
    if (!options.allowTable) {
      throw new CliError(
        "VALIDATION_ERROR",
        "Output format 'table' is not supported for this command.",
      );
    }

    const rows = toTableRows(data);
    if (rows.length === 0) {
      console.log("(empty)");
      return;
    }

    console.table(rows);
    return;
  }

  if (!options.textExtractor) {
    throw new CliError(
      "VALIDATION_ERROR",
      "Output format 'text' is not supported for this command.",
    );
  }

  const text = options.textExtractor(data);
  if (typeof text !== "string") {
    throw new CliError("VALIDATION_ERROR", "No text content available.");
  }

  process.stdout.write(text);
  if (!text.endsWith("\n")) {
    process.stdout.write("\n");
  }
}

function ensureOutputSupported(
  output: OutputFormat,
  options: { allowTable?: boolean; allowText?: boolean } = {},
) {
  if (output === "table" && !options.allowTable) {
    throw new CliError(
      "VALIDATION_ERROR",
      "Output format 'table' is not supported for this command.",
    );
  }

  if (output === "text" && !options.allowText) {
    throw new CliError(
      "VALIDATION_ERROR",
      "Output format 'text' is not supported for this command.",
    );
  }
}

function isCommanderHelpExit(error: unknown): boolean {
  return (
    error instanceof CommanderError &&
    (error.code === "commander.helpDisplayed" ||
      error.code === "commander.help" ||
      error.code === "commander.version" ||
      error.message === "(outputHelp)")
  );
}

function normalizeError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof CommanderError) {
    return new CliError("VALIDATION_ERROR", error.message);
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const responseData = error.response?.data;
    const message =
      (typeof responseData?.message === "string" && responseData.message) ||
      error.message ||
      "Request failed";

    if (status === 401 || status === 403) {
      return new CliError("AUTH_ERROR", message, responseData);
    }
    if (status === 404) {
      return new CliError("NOT_FOUND", message, responseData);
    }
    if (status === 400 || status === 422) {
      return new CliError("VALIDATION_ERROR", message, responseData);
    }

    if (!status) {
      return new CliError("NETWORK_ERROR", message, {
        code: error.code,
      });
    }

    return new CliError("INTERNAL_ERROR", message, responseData);
  }

  if (error instanceof Error) {
    return new CliError("INTERNAL_ERROR", error.message);
  }

  return new CliError("INTERNAL_ERROR", "Unknown error");
}

function printError(error: CliError, output: OutputFormat) {
  if (output === "json") {
    console.error(
      JSON.stringify(
        {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
        null,
        2,
      ),
    );
  } else {
    console.error(`Error [${error.code}]: ${error.message}`);
    if (error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
  }
}

function getSafeOutput(program: Command): OutputFormat {
  const opts = program.opts<GlobalOptions>();
  try {
    return normalizeOutputFormat(opts.output);
  } catch {
    return "json";
  }
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new CliError(
      "VALIDATION_ERROR",
      "No stdin data. Pipe content or use @file syntax.",
    );
  }

  return new Promise((resolve, reject) => {
    let data = "";

    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      if (!data.trim()) {
        reject(new CliError("VALIDATION_ERROR", "Stdin is empty. Provide content via pipe."));
        return;
      }
      resolve(data);
    });
    process.stdin.on("error", reject);
  });
}

async function resolveContentInput(content: string): Promise<string> {
  if (content === "-") {
    return readStdin();
  }

  if (content.startsWith("@")) {
    const filePath = content.slice(1);
    if (!filePath) {
      throw new CliError(
        "VALIDATION_ERROR",
        "Invalid content file syntax. Use --content @path/to/file.md",
      );
    }
    try {
      return await readFile(filePath, "utf-8");
    } catch (err: any) {
      throw new CliError(
        "VALIDATION_ERROR",
        `Cannot read file '${filePath}': ${err.code || err.message}`,
      );
    }
  }

  return content;
}

function parsePageIds(csv: string): string[] {
  const pageIds = csv
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (pageIds.length === 0) {
    throw new CliError("VALIDATION_ERROR", "--page-ids must not be empty");
  }

  return pageIds;
}

async function withClient(
  program: Command,
  run: (client: DocmostClient, opts: ResolvedOptions) => Promise<void>,
) {
  const opts = resolveOptions(program.opts<GlobalOptions>());
  const client = new DocmostClient(opts.apiUrl, opts.auth);
  await run(client, opts);
}

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
    .option("-o, --output <format>", "Output format: json | table | text", "json")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  docmost --api-url http://localhost:3000/api --token <token> workspace",
        "  DOCMOST_PASSWORD=secret docmost --api-url http://localhost:3000/api --email admin@example.com search \"onboarding\"",
        "  docmost list-pages --space-id <space-id> --output table",
        "  docmost get-page --page-id <page-id> --output text",
        "",
        "Auth precedence:",
        "  1) --token, then DOCMOST_TOKEN",
        "  2) --email/--password, then DOCMOST_EMAIL/DOCMOST_PASSWORD",
        "",
        "Security: CLI flags are visible in process lists. Use env vars for credentials.",
      ].join("\n"),
    )
    .exitOverride();

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

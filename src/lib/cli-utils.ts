import { readFile } from "fs/promises";
import axios from "axios";
import { Command, CommanderError } from "commander";
import { DocmostClient, type ClientAuthOptions } from "../client.js";

export type OutputFormat = "json" | "table" | "text";

export type PrintOptions = {
  allowTable?: boolean;
  textExtractor?: (result: unknown) => string | undefined;
  hasMore?: boolean;
};

export type GlobalOptions = {
  apiUrl?: string;
  email?: string;
  password?: string;
  token?: string;
  format?: string;
  quiet?: boolean;
  limit?: string;
  maxItems?: string;
};

export type SuccessEnvelope<T = unknown> = {
  ok: true;
  data: T;
  meta?: { count: number; hasMore: boolean };
};

export type ErrorEnvelope = {
  ok: false;
  error: { code: CliErrorCode; message: string; details?: unknown };
};

export type ResolvedOptions = {
  apiUrl: string;
  format: OutputFormat;
  quiet: boolean;
  limit: number;
  maxItems: number;
  auth: ClientAuthOptions;
};

export type CliErrorCode =
  | "AUTH_ERROR"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "INTERNAL_ERROR";

export const EXIT_CODES: Record<CliErrorCode, number> = {
  AUTH_ERROR: 2,
  NOT_FOUND: 3,
  VALIDATION_ERROR: 4,
  NETWORK_ERROR: 5,
  INTERNAL_ERROR: 1,
};

export class CliError extends Error {
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

export function normalizeOutputFormat(value: string | undefined): OutputFormat {
  const normalized = (value || "json").toLowerCase();
  if (normalized === "json" || normalized === "table" || normalized === "text") {
    return normalized;
  }
  throw new CliError(
    "VALIDATION_ERROR",
    `Unsupported output format '${value}'. Use json, table, or text.`,
  );
}

export function resolveOptions(raw: GlobalOptions, options?: { requireAuth?: boolean }): ResolvedOptions {
  const requireAuth = options?.requireAuth ?? true;
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

  if (requireAuth && !token && (!email || !password)) {
    throw new CliError(
      "VALIDATION_ERROR",
      "Authentication is required: provide --token (or DOCMOST_TOKEN) or both --email/--password (or DOCMOST_EMAIL/DOCMOST_PASSWORD).",
    );
  }

  const outputFormat = normalizeOutputFormat(raw.format);

  const parsedLimit = parseInt(raw.limit || "100", 10);
  if (isNaN(parsedLimit)) {
    throw new CliError("VALIDATION_ERROR", `Invalid --limit value '${raw.limit}'. Must be a number.`);
  }
  const limit = Math.max(1, Math.min(100, parsedLimit));

  const parsedMaxItems = parseInt(raw.maxItems || "0", 10);
  if (isNaN(parsedMaxItems)) {
    throw new CliError("VALIDATION_ERROR", `Invalid --max-items value '${raw.maxItems}'. Must be a number.`);
  }
  const maxItems = parsedMaxItems > 0 ? parsedMaxItems : Infinity;

  const auth: ClientAuthOptions = token
    ? { token }
    : (email && password ? { email, password } : {});

  return {
    apiUrl,
    format: outputFormat,
    quiet: raw.quiet ?? false,
    limit,
    maxItems,
    auth,
  };
}

export function flattenForTable(row: unknown): Record<string, unknown> {
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

export function toTableRows(data: unknown): Record<string, unknown>[] {
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

export function printResult(
  data: unknown,
  opts: ResolvedOptions,
  options: PrintOptions = {},
) {
  if (opts.quiet) return;
  const output = opts.format;
  if (output === "json") {
    if (Array.isArray(data)) {
      const envelope: SuccessEnvelope = {
        ok: true,
        data,
        meta: { count: data.length, hasMore: options.hasMore ?? false },
      };
      console.log(JSON.stringify(envelope, null, 2));
    } else {
      const envelope: SuccessEnvelope = { ok: true, data };
      console.log(JSON.stringify(envelope, null, 2));
    }
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

export function ensureOutputSupported(
  opts: ResolvedOptions,
  options: { allowTable?: boolean; allowText?: boolean } = {},
) {
  const output = opts.format;
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

export function isCommanderHelpExit(error: unknown): boolean {
  return (
    error instanceof CommanderError &&
    (error.code === "commander.helpDisplayed" ||
      error.code === "commander.help" ||
      error.code === "commander.version" ||
      error.message === "(outputHelp)")
  );
}

export function normalizeError(error: unknown): CliError {
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
    return new CliError("INTERNAL_ERROR", error.message, error.cause ? { cause: error.cause instanceof Error ? error.cause.message : String(error.cause) } : undefined);
  }

  return new CliError("INTERNAL_ERROR", "Unknown error");
}

export function printError(error: CliError, output: OutputFormat) {
  const envelope: ErrorEnvelope = {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
  if (output === "json") {
    console.error(JSON.stringify(envelope, null, 2));
  } else {
    console.error(`Error [${error.code}]: ${error.message}`);
    if (error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
  }
}

export function getSafeOutput(program: Command): OutputFormat {
  const opts = program.opts<GlobalOptions>();
  try {
    return normalizeOutputFormat(opts.format);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Warning: ${msg} Falling back to json.`);
    return "json";
  }
}

export async function readStdin(): Promise<string> {
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

export async function resolveContentInput(content: string): Promise<string> {
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new CliError(
        "VALIDATION_ERROR",
        `Cannot read file '${filePath}': ${msg}`,
      );
    }
  }

  return content;
}

export function parseCommaSeparatedIds(flagName: string, csv: string): string[] {
  const ids = csv
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    throw new CliError("VALIDATION_ERROR", `${flagName} must not be empty`);
  }

  return ids;
}

/** @deprecated Use parseCommaSeparatedIds instead */
export function parsePageIds(csv: string): string[] {
  return parseCommaSeparatedIds("--page-ids", csv);
}

export async function withClient(
  program: Command,
  run: (client: DocmostClient, opts: ResolvedOptions) => Promise<void>,
) {
  const opts = resolveOptions(program.opts<GlobalOptions>());
  const client = new DocmostClient(opts.apiUrl, opts.auth);
  await run(client, opts);
}

export async function withPublicClient(
  program: Command,
  run: (client: DocmostClient, opts: ResolvedOptions) => Promise<void>,
) {
  const opts = resolveOptions(program.opts<GlobalOptions>(), { requireAuth: false });
  const client = new DocmostClient(opts.apiUrl, opts.auth);
  await run(client, opts);
}

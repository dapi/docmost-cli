import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { CommanderError } from "commander";

const {
  normalizeOutputFormat,
  resolveOptions,
  normalizeError,
  flattenForTable,
  toTableRows,
  parseCommaSeparatedIds,
  CliError,
  EXIT_CODES,
  isCommanderHelpExit,
} = await import("../lib/cli-utils.js");

// ── normalizeOutputFormat ────────────────────────────────────────────

describe("normalizeOutputFormat", () => {
  it.each(["json", "table", "text"] as const)("accepts '%s'", (fmt) => {
    expect(normalizeOutputFormat(fmt)).toBe(fmt);
  });

  it("is case insensitive", () => {
    expect(normalizeOutputFormat("JSON")).toBe("json");
    expect(normalizeOutputFormat("Table")).toBe("table");
    expect(normalizeOutputFormat("TEXT")).toBe("text");
  });

  it("defaults to json when undefined", () => {
    expect(normalizeOutputFormat(undefined)).toBe("json");
  });

  it("throws VALIDATION_ERROR for invalid format", () => {
    expect(() => normalizeOutputFormat("csv")).toThrow(CliError);
    try {
      normalizeOutputFormat("csv");
    } catch (e) {
      expect((e as InstanceType<typeof CliError>).code).toBe("VALIDATION_ERROR");
    }
  });
});

// ── resolveOptions ───────────────────────────────────────────────────

describe("resolveOptions", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      "DOCMOST_API_URL",
      "DOCMOST_TOKEN",
      "DOCMOST_EMAIL",
      "DOCMOST_PASSWORD",
    ]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("throws when apiUrl is missing", () => {
    expect(() => resolveOptions({})).toThrow(CliError);
    expect(() => resolveOptions({})).toThrow(/API URL is required/);
  });

  it("reads apiUrl from env", () => {
    process.env.DOCMOST_API_URL = "http://env-url";
    process.env.DOCMOST_TOKEN = "tok";
    const opts = resolveOptions({});
    expect(opts.apiUrl).toBe("http://env-url");
  });

  it("throws when requireAuth=true and no auth provided", () => {
    expect(() => resolveOptions({ apiUrl: "http://x" })).toThrow(/Authentication is required/);
  });

  it("skips auth check when requireAuth=false", () => {
    const opts = resolveOptions({ apiUrl: "http://x" }, { requireAuth: false });
    expect(opts.apiUrl).toBe("http://x");
  });

  it("accepts token auth", () => {
    const opts = resolveOptions({ apiUrl: "http://x", token: "t1" });
    expect(opts.auth).toEqual({ token: "t1" });
  });

  it("accepts email/password auth", () => {
    const opts = resolveOptions({ apiUrl: "http://x", email: "a@b", password: "p" });
    expect(opts.auth).toEqual({ email: "a@b", password: "p" });
  });

  it("token takes precedence over email/password", () => {
    const opts = resolveOptions({
      apiUrl: "http://x",
      token: "tok",
      email: "a@b",
      password: "p",
    });
    expect(opts.auth).toEqual({ token: "tok" });
  });

  it("clamps limit below 1 to 1", () => {
    const opts = resolveOptions({ apiUrl: "http://x", token: "t", limit: "0" });
    expect(opts.limit).toBe(1);
  });

  it("clamps limit above 100 to 100", () => {
    const opts = resolveOptions({ apiUrl: "http://x", token: "t", limit: "999" });
    expect(opts.limit).toBe(100);
  });

  it("defaults limit to 100", () => {
    const opts = resolveOptions({ apiUrl: "http://x", token: "t" });
    expect(opts.limit).toBe(100);
  });

  it("maxItems defaults to Infinity when 0 or not set", () => {
    const opts1 = resolveOptions({ apiUrl: "http://x", token: "t" });
    expect(opts1.maxItems).toBe(Infinity);
    const opts2 = resolveOptions({ apiUrl: "http://x", token: "t", maxItems: "0" });
    expect(opts2.maxItems).toBe(Infinity);
  });

  it("maxItems set to positive value", () => {
    const opts = resolveOptions({ apiUrl: "http://x", token: "t", maxItems: "50" });
    expect(opts.maxItems).toBe(50);
  });

  it("throws on invalid limit", () => {
    expect(() =>
      resolveOptions({ apiUrl: "http://x", token: "t", limit: "abc" }),
    ).toThrow(/Invalid --limit/);
  });

  it("throws on invalid maxItems", () => {
    expect(() =>
      resolveOptions({ apiUrl: "http://x", token: "t", maxItems: "abc" }),
    ).toThrow(/Invalid --max-items/);
  });
});

// ── normalizeError ───────────────────────────────────────────────────

describe("normalizeError", () => {
  it("passes CliError through unchanged", () => {
    const err = new CliError("NOT_FOUND", "gone");
    expect(normalizeError(err)).toBe(err);
  });

  it("converts CommanderError to VALIDATION_ERROR", () => {
    const err = new CommanderError(1, "commander.missingArgument", "missing arg");
    const result = normalizeError(err);
    expect(result).toBeInstanceOf(CliError);
    expect(result.code).toBe("VALIDATION_ERROR");
  });

  it.each([401, 403])("converts AxiosError %d to AUTH_ERROR", (status) => {
    const err = new AxiosError("fail", "ERR", undefined, undefined, {
      status,
      data: {},
      statusText: "",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    expect(normalizeError(err).code).toBe("AUTH_ERROR");
  });

  it("converts AxiosError 404 to NOT_FOUND", () => {
    const err = new AxiosError("fail", "ERR", undefined, undefined, {
      status: 404,
      data: {},
      statusText: "",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    expect(normalizeError(err).code).toBe("NOT_FOUND");
  });

  it.each([400, 422])("converts AxiosError %d to VALIDATION_ERROR", (status) => {
    const err = new AxiosError("fail", "ERR", undefined, undefined, {
      status,
      data: {},
      statusText: "",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    expect(normalizeError(err).code).toBe("VALIDATION_ERROR");
  });

  it("converts AxiosError without response to NETWORK_ERROR", () => {
    const err = new AxiosError("timeout", "ECONNABORTED");
    expect(normalizeError(err).code).toBe("NETWORK_ERROR");
  });

  it("converts plain Error to INTERNAL_ERROR", () => {
    const result = normalizeError(new Error("boom"));
    expect(result.code).toBe("INTERNAL_ERROR");
    expect(result.message).toBe("boom");
  });

  it("converts unknown value to INTERNAL_ERROR", () => {
    const result = normalizeError("string-error");
    expect(result.code).toBe("INTERNAL_ERROR");
    expect(result.message).toBe("Unknown error");
  });

  it("converts AxiosError with response message from data", () => {
    const err = new AxiosError("generic", "ERR", undefined, undefined, {
      status: 404,
      data: { message: "Page not found" },
      statusText: "",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    const result = normalizeError(err);
    expect(result.message).toBe("Page not found");
  });
});

// ── flattenForTable ──────────────────────────────────────────────────

describe("flattenForTable", () => {
  it("wraps primitives in { value }", () => {
    expect(flattenForTable(42)).toEqual({ value: 42 });
    expect(flattenForTable("hello")).toEqual({ value: "hello" });
    expect(flattenForTable(true)).toEqual({ value: true });
  });

  it("handles null", () => {
    expect(flattenForTable(null)).toEqual({ value: null });
  });

  it("passes through primitive object values", () => {
    expect(flattenForTable({ a: 1, b: "x", c: null, d: true })).toEqual({
      a: 1,
      b: "x",
      c: null,
      d: true,
    });
  });

  it("joins primitive arrays with comma", () => {
    expect(flattenForTable({ tags: ["a", "b", "c"] })).toEqual({
      tags: "a, b, c",
    });
  });

  it("stringifies non-primitive arrays", () => {
    const result = flattenForTable({ items: [{ id: 1 }] });
    expect(result.items).toBe(JSON.stringify([{ id: 1 }]));
  });

  it("stringifies nested objects", () => {
    const result = flattenForTable({ nested: { x: 1 } });
    expect(result.nested).toBe(JSON.stringify({ x: 1 }));
  });
});

// ── toTableRows ──────────────────────────────────────────────────────

describe("toTableRows", () => {
  it("handles array input", () => {
    const rows = toTableRows([{ id: 1 }, { id: 2 }]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: 1 });
  });

  it("handles object with items", () => {
    const rows = toTableRows({ items: [{ id: 1 }] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ id: 1 });
  });

  it("handles nested data.items", () => {
    const rows = toTableRows({ data: { items: [{ id: 1 }] } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ id: 1 });
  });

  it("falls back to single object row", () => {
    const rows = toTableRows({ name: "test" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ name: "test" });
  });
});

// ── parseCommaSeparatedIds ───────────────────────────────────────────

describe("parseCommaSeparatedIds", () => {
  it("parses normal CSV", () => {
    expect(parseCommaSeparatedIds("--ids", "a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace", () => {
    expect(parseCommaSeparatedIds("--ids", " a , b , c ")).toEqual(["a", "b", "c"]);
  });

  it("throws on empty string", () => {
    expect(() => parseCommaSeparatedIds("--ids", "")).toThrow(CliError);
    expect(() => parseCommaSeparatedIds("--ids", "")).toThrow(/must not be empty/);
  });

  it("throws on whitespace-only input", () => {
    expect(() => parseCommaSeparatedIds("--ids", " , , ")).toThrow(/must not be empty/);
  });
});

// ── CliError ─────────────────────────────────────────────────────────

describe("CliError", () => {
  it.each(Object.entries(EXIT_CODES) as [string, number][])(
    "sets exitCode %d for code %s",
    (code, exitCode) => {
      const err = new CliError(code as any, "msg");
      expect(err.exitCode).toBe(exitCode);
    },
  );

  it("stores details", () => {
    const err = new CliError("NOT_FOUND", "gone", { id: "x" });
    expect(err.details).toEqual({ id: "x" });
  });

  it("is an instance of Error", () => {
    expect(new CliError("INTERNAL_ERROR", "x")).toBeInstanceOf(Error);
  });
});

// ── isCommanderHelpExit ──────────────────────────────────────────────

describe("isCommanderHelpExit", () => {
  it("returns true for commander.helpDisplayed", () => {
    expect(isCommanderHelpExit(new CommanderError(0, "commander.helpDisplayed", ""))).toBe(true);
  });

  it("returns true for commander.help", () => {
    expect(isCommanderHelpExit(new CommanderError(0, "commander.help", ""))).toBe(true);
  });

  it("returns true for commander.version", () => {
    expect(isCommanderHelpExit(new CommanderError(0, "commander.version", ""))).toBe(true);
  });

  it("returns true for (outputHelp) message", () => {
    expect(isCommanderHelpExit(new CommanderError(0, "other", "(outputHelp)"))).toBe(true);
  });

  it("returns false for other CommanderError codes", () => {
    expect(isCommanderHelpExit(new CommanderError(1, "commander.missingArgument", "x"))).toBe(false);
  });

  it("returns false for non-CommanderError", () => {
    expect(isCommanderHelpExit(new Error("help"))).toBe(false);
    expect(isCommanderHelpExit("commander.helpDisplayed")).toBe(false);
  });
});

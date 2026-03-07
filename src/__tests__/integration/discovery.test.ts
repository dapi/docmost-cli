import { describe, it, expect } from "vitest";
import { runCli, parseEnvelope } from "./helpers/run-cli.js";

describe("commands discovery", () => {
  it("returns envelope with all commands", async () => {
    // Discovery doesn't need auth
    const result = await runCli(["commands"], {});
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);
    expect(envelope.data.length).toBeGreaterThan(50);
    expect(envelope.meta).toEqual({ count: envelope.data.length, hasMore: false });
  });

  it("each command has name, description, options", async () => {
    const result = await runCli(["commands"], {});
    const envelope = parseEnvelope(result);

    for (const cmd of envelope.data) {
      expect(cmd).toHaveProperty("name");
      expect(cmd).toHaveProperty("description");
      expect(cmd).toHaveProperty("options");
      expect(Array.isArray(cmd.options)).toBe(true);
    }
  });
});

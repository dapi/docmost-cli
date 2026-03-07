import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("search commands", () => {
  let spaceId: string;

  beforeAll(async () => {
    const result = await runCli(
      ["space-create", "--name", `search-test-space-${Date.now()}`],
      env,
    );
    spaceId = parseEnvelope(result).data.id;

    // Create a page with searchable content
    await runCli(
      ["page-create", "--space-id", spaceId, "--title", "UniqueSearchTerm42"],
      env,
    );

    // Poll until search index catches up (max 15s)
    for (let i = 0; i < 15; i++) {
      const probe = await runCli(["search", "--query", "UniqueSearchTerm42"], env);
      const probeEnv = parseEnvelope(probe);
      if (probeEnv.ok && Array.isArray(probeEnv.data) && probeEnv.data.length > 0) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
  });

  it("search returns results for known term", async () => {
    const result = await runCli(
      ["search", "--query", "UniqueSearchTerm42"],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);
    expect(envelope.data.length).toBeGreaterThan(0);
  });

  it("search-suggest returns suggestions", async () => {
    const result = await runCli(
      ["search-suggest", "--query", "Unique"],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  afterAll(async () => {
    if (spaceId) {
      await runCli(["space-delete", "--space-id", spaceId], env);
    }
  });
});

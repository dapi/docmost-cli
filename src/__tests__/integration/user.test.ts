import { describe, it, expect } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("user commands", () => {
  it("user-me returns current user", async () => {
    const result = await runCli(["user-me"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("id");
    expect(envelope.data).toHaveProperty("email");
  });
});

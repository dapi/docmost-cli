import { describe, it, expect } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("workspace commands", () => {
  it("workspace-info returns workspace data", async () => {
    const result = await runCli(["workspace-info"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("name");
    expect(envelope.data).toHaveProperty("id");
  });

  it("workspace-public returns public info without auth", async () => {
    const result = await runCli(["workspace-public"], {
      DOCMOST_API_URL: env.DOCMOST_API_URL,
    });
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    // workspace-public wraps response as { data: { name, ... }, success: true }
    const wsData = envelope.data.data ?? envelope.data;
    expect(wsData).toHaveProperty("name");
  });

  it("member-list returns array", async () => {
    const result = await runCli(["member-list"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);
    expect(envelope.meta).toHaveProperty("count");
  });

  it("workspace-info with invalid token returns AUTH_ERROR", async () => {
    const result = await runCli(["workspace-info"], {
      DOCMOST_API_URL: env.DOCMOST_API_URL,
      DOCMOST_TOKEN: "invalid-token-12345",
    });

    expect(result.exitCode).not.toBe(0);
    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe("AUTH_ERROR");
  });
});

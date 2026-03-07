import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("share commands", () => {
  let spaceId: string;
  let pageId: string;
  let shareId: string;

  beforeAll(async () => {
    const spaceResult = await runCli(
      ["space-create", "--name", `share-test-space-${Date.now()}`],
      env,
    );
    spaceId = parseEnvelope(spaceResult).data.id;

    const pageResult = await runCli(
      ["page-create", "--space-id", spaceId, "--title", "Share Test Page"],
      env,
    );
    pageId = parseEnvelope(pageResult).data.id;
  });

  it("share-create enables sharing for a page", async () => {
    const result = await runCli(
      ["share-create", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("id");
    shareId = envelope.data.id;
  });

  it("share-info returns share details", async () => {
    const result = await runCli(
      ["share-info", "--share-id", shareId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  it("share-for-page returns share by page ID", async () => {
    const result = await runCli(
      ["share-for-page", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  it("share-list returns shares", async () => {
    const result = await runCli(["share-list"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  it("share-delete removes sharing", async () => {
    const result = await runCli(
      ["share-delete", "--share-id", shareId],
      env,
    );
    expect(result.exitCode).toBe(0);
  });

  afterAll(async () => {
    if (spaceId) {
      await runCli(["space-delete", "--space-id", spaceId], env);
    }
  });
});

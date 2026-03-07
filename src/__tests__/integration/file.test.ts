import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("file commands", () => {
  let spaceId: string;
  let pageId: string;
  let tmpDir: string;

  beforeAll(async () => {
    const spaceResult = await runCli(
      ["space-create", "--name", `file-test-space-${Date.now()}`],
      env,
    );
    spaceId = parseEnvelope(spaceResult).data.id;

    const pageResult = await runCli(
      ["page-create", "--space-id", spaceId, "--title", "File Test Page"],
      env,
    );
    pageId = parseEnvelope(pageResult).data.id;

    // Create a temp file for upload
    tmpDir = mkdtempSync(join(tmpdir(), "docmost-test-"));
    writeFileSync(join(tmpDir, "test.txt"), "Hello from integration test");
  });

  it("file-upload uploads a file", async () => {
    const result = await runCli(
      ["file-upload", "--page-id", pageId, "--file", join(tmpDir, "test.txt")],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  afterAll(async () => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
    if (spaceId) {
      await runCli(["space-delete", "--space-id", spaceId], env);
    }
  });
});

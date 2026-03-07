import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("comment commands", () => {
  let spaceId: string;
  let pageId: string;
  let commentId: string;

  beforeAll(async () => {
    const spaceResult = await runCli(
      ["space-create", "--name", `commentspace${Date.now()}`, "--slug", `cs${Date.now()}`],
      env,
    );
    spaceId = parseEnvelope(spaceResult).data.id;

    const pageResult = await runCli(
      ["page-create", "--space-id", spaceId, "--title", "Comment Test Page"],
      env,
    );
    pageId = parseEnvelope(pageResult).data.id;
  });

  it("comment-create creates a comment", async () => {
    const result = await runCli(
      ["comment-create", "--page-id", pageId, "--content", "Test comment"],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    // createComment returns raw response.data; actual comment may be nested in .data
    const comment = envelope.data.data ?? envelope.data;
    expect(comment).toHaveProperty("id");
    commentId = comment.id;
  });

  it("comment-list returns comments for page", async () => {
    const result = await runCli(
      ["comment-list", "--page-id", pageId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);
    expect(envelope.data.length).toBeGreaterThanOrEqual(1);
  });

  it("comment-info returns comment details", async () => {
    const result = await runCli(
      ["comment-info", "--comment-id", commentId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.id).toBe(commentId);
  });

  it("comment-delete deletes the comment", async () => {
    const result = await runCli(
      ["comment-delete", "--comment-id", commentId],
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

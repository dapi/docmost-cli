import { describe, it, expect, afterAll } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("group commands", () => {
  let groupId: string;
  const groupName = `testgroup${Date.now()}`;

  it("group-create creates a group", async () => {
    const result = await runCli(
      ["group-create", "--name", groupName],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("id");
    groupId = envelope.data.id;
  });

  it("group-list includes created group", async () => {
    const result = await runCli(["group-list"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    const names = envelope.data.map((g: any) => g.name);
    expect(names).toContain(groupName);
  });

  it("group-info returns group details", async () => {
    const result = await runCli(
      ["group-info", "--group-id", groupId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.id).toBe(groupId);
  });

  it("group-update changes name", async () => {
    const newName = `${groupName}-updated`;
    const result = await runCli(
      ["group-update", "--group-id", groupId, "--name", newName],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  it("group-member-list returns members", async () => {
    const result = await runCli(
      ["group-member-list", "--group-id", groupId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  afterAll(async () => {
    if (groupId) {
      await runCli(["group-delete", "--group-id", groupId], env);
    }
  });
});

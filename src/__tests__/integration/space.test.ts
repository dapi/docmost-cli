import { describe, it, expect, afterAll } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("space commands", () => {
  let spaceId: string;
  const spaceName = `test-space-${Date.now()}`;

  it("space-create creates a space", async () => {
    const result = await runCli(
      ["space-create", "--name", spaceName],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveProperty("id");
    expect(envelope.data.name).toBe(spaceName);
    spaceId = envelope.data.id;
  });

  it("space-list includes created space", async () => {
    expect(spaceId).toBeDefined();
    const result = await runCli(["space-list"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    const names = envelope.data.map((s: any) => s.name);
    expect(names).toContain(spaceName);
  });

  it("space-info returns space details", async () => {
    expect(spaceId).toBeDefined();
    const result = await runCli(
      ["space-info", "--space-id", spaceId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.id).toBe(spaceId);
    expect(envelope.data.name).toBe(spaceName);
  });

  it("space-update changes name", async () => {
    expect(spaceId).toBeDefined();
    const newName = `${spaceName}-updated`;
    const result = await runCli(
      ["space-update", "--space-id", spaceId, "--name", newName],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.name).toBe(newName);
  });

  it("space-info on non-existent ID returns error", async () => {
    const result = await runCli(
      ["space-info", "--space-id", "00000000-0000-0000-0000-000000000000"],
      env,
    );
    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(false);
  });

  afterAll(async () => {
    if (spaceId) {
      await runCli(["space-delete", "--space-id", spaceId], env);
    }
  });
});

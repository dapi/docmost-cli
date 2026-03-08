import { describe, it, expect } from "vitest";
import { runCli, parseEnvelope, testEnv } from "./helpers/run-cli.js";

const env = testEnv();

describe("invite commands", () => {
  let inviteId: string;
  const inviteEmail = `invite-${Date.now()}@example.com`;

  it("invite-create sends an invite", async () => {
    const result = await runCli(
      ["invite-create", "--emails", inviteEmail, "--role", "member"],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
  });

  it("invite-list includes the invite", async () => {
    const result = await runCli(["invite-list"], env);
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.data)).toBe(true);

    const invite = envelope.data.find((i: any) => i.email === inviteEmail);
    expect(invite).toBeDefined();
    inviteId = invite.id;
  });

  it("invite-info returns invite details", async () => {
    const result = await runCli(
      ["invite-info", "--invitation-id", inviteId],
      env,
    );
    expect(result.exitCode).toBe(0);

    const envelope = parseEnvelope(result);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.email).toBe(inviteEmail);
  });

  it("invite-revoke revokes the invite", async () => {
    const result = await runCli(
      ["invite-revoke", "--invitation-id", inviteId],
      env,
    );
    expect(result.exitCode).toBe(0);
  });
});

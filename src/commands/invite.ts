import { Command, Option } from "commander";
import {
  ensureOutputSupported,
  parseCommaSeparatedIds,
  printResult,
  withClient,
} from "../lib/cli-utils.js";

export function register(program: Command) {
  program
    .command("invite-list")
    .description("List workspace invitations")
    .action(() =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getInvites();
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("invite-info")
    .description("Get invitation details")
    .requiredOption("--invitation-id <id>", "Invitation ID")
    .action((options: { invitationId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.getInviteInfo(options.invitationId);
        printResult(result, opts);
      }),
    );

  program
    .command("invite-create")
    .description("Create workspace invitation(s)")
    .requiredOption("--emails <emails>", "Comma-separated email addresses")
    .addOption(
      new Option("--role <role>", "Role for invited users")
        .choices(["owner", "admin", "member"])
        .makeOptionMandatory(),
    )
    .option("--group-ids <ids>", "Comma-separated group IDs")
    .action((options: { emails: string; role: string; groupIds?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const emails = parseCommaSeparatedIds("--emails", options.emails);
        const groupIds = options.groupIds
          ? parseCommaSeparatedIds("--group-ids", options.groupIds)
          : undefined;
        const result = await client.createInvite(emails, options.role, groupIds);
        printResult(result, opts);
      }),
    );

  program
    .command("invite-revoke")
    .description("Revoke a workspace invitation")
    .requiredOption("--invitation-id <id>", "Invitation ID")
    .action((options: { invitationId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.revokeInvite(options.invitationId);
        printResult(result, opts);
      }),
    );

  program
    .command("invite-resend")
    .description("Resend a workspace invitation")
    .requiredOption("--invitation-id <id>", "Invitation ID")
    .action((options: { invitationId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.resendInvite(options.invitationId);
        printResult(result, opts);
      }),
    );

  program
    .command("invite-link")
    .description("Get invitation link")
    .requiredOption("--invitation-id <id>", "Invitation ID")
    .action((options: { invitationId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowText: true });
        const result = await client.getInviteLink(options.invitationId);
        printResult(result, opts, {
          textExtractor: (data: any) => data?.inviteLink,
        });
      }),
    );
}

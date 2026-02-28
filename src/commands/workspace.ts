import { Command, Option } from "commander";
import {
  CliError,
  ensureOutputSupported,
  printResult,
  withClient,
  withPublicClient,
} from "../lib/cli-utils.js";

export function register(program: Command) {
  program
    .command("workspace-info")
    .description("Get the current Docmost workspace")
    .action(() =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getWorkspace();
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("workspace-public")
    .description("Get public workspace information (no auth required)")
    .action(() =>
      withPublicClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getWorkspacePublic();
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("workspace-update")
    .description("Update workspace settings")
    .option("--name <name>", "Workspace name")
    .option("--hostname <hostname>", "Workspace hostname")
    .option("--description <description>", "Workspace description")
    .option("--logo <logo>", "Workspace logo URL")
    .option("--email-domains <domains>", "Allowed email domains (comma-separated)")
    .addOption(new Option("--enforce-sso <bool>", "Enforce SSO authentication").choices(["true", "false"]))
    .addOption(new Option("--enforce-mfa <bool>", "Enforce multi-factor authentication").choices(["true", "false"]))
    .addOption(new Option("--restrict-api-to-admins <bool>", "Restrict API access to admins only").choices(["true", "false"]))
    .action(
      (options: {
        name?: string;
        hostname?: string;
        description?: string;
        logo?: string;
        emailDomains?: string;
        enforceSso?: string;
        enforceMfa?: string;
        restrictApiToAdmins?: string;
      }) =>
        withClient(program, async (client, opts) => {
          ensureOutputSupported(opts);
          const params: Record<string, unknown> = {
            ...(options.name !== undefined && { name: options.name }),
            ...(options.hostname !== undefined && { hostname: options.hostname }),
            ...(options.description !== undefined && { description: options.description }),
            ...(options.logo !== undefined && { logo: options.logo }),
            ...(options.emailDomains !== undefined && { emailDomains: options.emailDomains.split(",").map(d => d.trim()).filter(Boolean) }),
            ...(options.enforceSso !== undefined && { enableSSO: options.enforceSso === "true" }),
            ...(options.enforceMfa !== undefined && { enableMFA: options.enforceMfa === "true" }),
            ...(options.restrictApiToAdmins !== undefined && { restrictApiToAdmins: options.restrictApiToAdmins === "true" }),
          };

          if (Object.keys(params).length === 0) {
            throw new CliError(
              "VALIDATION_ERROR",
              "At least one update flag is required.",
            );
          }

          const result = await client.updateWorkspace(params);
          printResult(result, opts);
        }),
    );

  // Member commands

  program
    .command("member-list")
    .description("List workspace members")
    .action(() =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getMembers();
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("member-remove")
    .description("Remove a member from the workspace")
    .requiredOption("--user-id <id>", "User ID to remove")
    .action((options: { userId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.removeMember(options.userId);
        printResult(result, opts);
      }),
    );

  program
    .command("member-role")
    .description("Change a member's role")
    .requiredOption("--user-id <id>", "User ID")
    .addOption(new Option("--role <role>", "New role").choices(["owner", "admin", "member"]).makeOptionMandatory())
    .action((options: { userId: string; role: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.changeMemberRole(options.userId, options.role);
        printResult(result, opts);
      }),
    );
}

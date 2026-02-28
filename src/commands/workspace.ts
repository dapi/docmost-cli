import { Command } from "commander";
import {
  type ResolvedOptions,
  CliError,
  ensureOutputSupported,
  printResult,
  withClient,
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
      withClient(program, async (client, opts) => {
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
    .option("--enforce-sso", "Enforce SSO authentication")
    .option("--enforce-mfa", "Enforce multi-factor authentication")
    .option("--restrict-api-to-admins", "Restrict API access to admins only")
    .action(
      (options: {
        name?: string;
        hostname?: string;
        description?: string;
        logo?: string;
        emailDomains?: string;
        enforceSso?: boolean;
        enforceMfa?: boolean;
        restrictApiToAdmins?: boolean;
      }) =>
        withClient(program, async (client, opts) => {
          ensureOutputSupported(opts);
          const params: Record<string, unknown> = {
            ...(options.name !== undefined && { name: options.name }),
            ...(options.hostname !== undefined && { hostname: options.hostname }),
            ...(options.description !== undefined && { description: options.description }),
            ...(options.logo !== undefined && { logo: options.logo }),
            ...(options.emailDomains !== undefined && { emailDomains: options.emailDomains }),
            ...(options.enforceSso !== undefined && { enableSSO: options.enforceSso }),
            ...(options.enforceMfa !== undefined && { enableMFA: options.enforceMfa }),
            ...(options.restrictApiToAdmins !== undefined && { restrictApiToAdmins: options.restrictApiToAdmins }),
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

}

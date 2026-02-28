import { writeFileSync } from "fs";
import { Command, Option } from "commander";
import {
  CliError,
  ensureOutputSupported,
  parseCommaSeparatedIds,
  printResult,
  withClient,
} from "../lib/cli-utils.js";

export function register(program: Command) {
  program
    .command("space-list")
    .description("List all available spaces")
    .action(() =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getSpaces();
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("space-info")
    .description("Get space details")
    .requiredOption("--space-id <id>", "Space ID")
    .action((options: { spaceId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getSpaceInfo(options.spaceId);
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("space-create")
    .description("Create a new space")
    .requiredOption("--name <name>", "Space name")
    .option("--slug <slug>", "Space slug")
    .option("--description <description>", "Space description")
    .action((options: { name: string; slug?: string; description?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.createSpace(options.name, options.slug, options.description);
        printResult(result, opts);
      }),
    );

  program
    .command("space-update")
    .description("Update space settings")
    .requiredOption("--space-id <id>", "Space ID")
    .option("--name <name>", "Space name")
    .option("--description <description>", "Space description")
    .action((options: { spaceId: string; name?: string; description?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const params: Record<string, unknown> = {
          ...(options.name !== undefined && { name: options.name }),
          ...(options.description !== undefined && { description: options.description }),
        };
        if (Object.keys(params).length === 0) {
          throw new CliError(
            "VALIDATION_ERROR",
            "At least one update flag is required (--name or --description).",
          );
        }
        const result = await client.updateSpace(options.spaceId, params);
        printResult(result, opts);
      }),
    );

  program
    .command("space-delete")
    .description("Delete a space")
    .requiredOption("--space-id <id>", "Space ID")
    .action((options: { spaceId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.deleteSpace(options.spaceId);
        printResult(result, opts);
      }),
    );

  program
    .command("space-export")
    .description("Export a space")
    .requiredOption("--space-id <id>", "Space ID")
    .addOption(
      new Option("--export-format <format>", "Export format")
        .choices(["html", "markdown"]),
    )
    .option("--include-attachments", "Include attachments in export")
    .option("--output <path>", "Output file path (default: stdout)")
    .action((options: { spaceId: string; exportFormat?: string; includeAttachments?: boolean; output?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const data = await client.exportSpace(options.spaceId, options.exportFormat, options.includeAttachments);
        if (options.output) {
          writeFileSync(options.output, Buffer.from(data));
          printResult({ success: true, message: `Exported to ${options.output}` }, opts);
        } else {
          process.stdout.write(Buffer.from(data));
        }
      }),
    );

  program
    .command("space-member-list")
    .description("List space members")
    .requiredOption("--space-id <id>", "Space ID")
    .action((options: { spaceId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getSpaceMembers(options.spaceId);
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("space-member-add")
    .description("Add members to a space")
    .requiredOption("--space-id <id>", "Space ID")
    .addOption(
      new Option("--role <role>", "Member role")
        .choices(["admin", "writer", "reader"])
        .makeOptionMandatory(),
    )
    .option("--user-ids <ids>", "Comma-separated user IDs")
    .option("--group-ids <ids>", "Comma-separated group IDs")
    .action((options: { spaceId: string; role: string; userIds?: string; groupIds?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const userIds = options.userIds
          ? parseCommaSeparatedIds("--user-ids", options.userIds)
          : undefined;
        const groupIds = options.groupIds
          ? parseCommaSeparatedIds("--group-ids", options.groupIds)
          : undefined;
        const result = await client.addSpaceMembers(options.spaceId, options.role, userIds, groupIds);
        printResult(result, opts);
      }),
    );

  program
    .command("space-member-remove")
    .description("Remove a member from a space")
    .requiredOption("--space-id <id>", "Space ID")
    .option("--user-id <id>", "User ID to remove")
    .option("--group-id <id>", "Group ID to remove")
    .action((options: { spaceId: string; userId?: string; groupId?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        if (options.userId && options.groupId) {
          throw new CliError(
            "VALIDATION_ERROR",
            "Specify either --user-id or --group-id, not both.",
          );
        }
        if (!options.userId && !options.groupId) {
          throw new CliError(
            "VALIDATION_ERROR",
            "Specify either --user-id or --group-id.",
          );
        }
        const result = await client.removeSpaceMember(options.spaceId, options.userId, options.groupId);
        printResult(result, opts);
      }),
    );

  program
    .command("space-member-role")
    .description("Change a space member's role")
    .requiredOption("--space-id <id>", "Space ID")
    .addOption(
      new Option("--role <role>", "New role")
        .choices(["admin", "writer", "reader"])
        .makeOptionMandatory(),
    )
    .option("--user-id <id>", "User ID")
    .option("--group-id <id>", "Group ID")
    .action((options: { spaceId: string; role: string; userId?: string; groupId?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        if (options.userId && options.groupId) {
          throw new CliError(
            "VALIDATION_ERROR",
            "Specify either --user-id or --group-id, not both.",
          );
        }
        if (!options.userId && !options.groupId) {
          throw new CliError(
            "VALIDATION_ERROR",
            "Specify either --user-id or --group-id.",
          );
        }
        const result = await client.changeSpaceMemberRole(options.spaceId, options.role, options.userId, options.groupId);
        printResult(result, opts);
      }),
    );
}

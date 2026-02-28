import { Command } from "commander";
import {
  CliError,
  ensureOutputSupported,
  parseCommaSeparatedIds,
  printResult,
  withClient,
} from "../lib/cli-utils.js";

export function register(program: Command) {
  program
    .command("group-list")
    .description("List all available groups")
    .action(() =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getGroups();
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("group-info")
    .description("Get group details")
    .requiredOption("--group-id <id>", "Group ID")
    .action((options: { groupId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getGroupInfo(options.groupId);
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("group-create")
    .description("Create a new group")
    .requiredOption("--name <name>", "Group name")
    .option("--description <description>", "Group description")
    .option("--user-ids <ids>", "Comma-separated user IDs")
    .action((options: { name: string; description?: string; userIds?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const userIds = options.userIds
          ? parseCommaSeparatedIds("--user-ids", options.userIds)
          : undefined;
        const result = await client.createGroup(options.name, options.description, userIds);
        printResult(result, opts);
      }),
    );

  program
    .command("group-update")
    .description("Update group settings")
    .requiredOption("--group-id <id>", "Group ID")
    .option("--name <name>", "Group name")
    .option("--description <description>", "Group description")
    .action((options: { groupId: string; name?: string; description?: string }) =>
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
        const result = await client.updateGroup(options.groupId, params);
        printResult(result, opts);
      }),
    );

  program
    .command("group-delete")
    .description("Delete a group")
    .requiredOption("--group-id <id>", "Group ID")
    .action((options: { groupId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.deleteGroup(options.groupId);
        printResult(result, opts);
      }),
    );

  program
    .command("group-member-list")
    .description("List group members")
    .requiredOption("--group-id <id>", "Group ID")
    .action((options: { groupId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getGroupMembers(options.groupId);
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("group-member-add")
    .description("Add members to a group")
    .requiredOption("--group-id <id>", "Group ID")
    .requiredOption("--user-ids <ids>", "Comma-separated user IDs")
    .action((options: { groupId: string; userIds: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const userIds = parseCommaSeparatedIds("--user-ids", options.userIds);
        const result = await client.addGroupMembers(options.groupId, userIds);
        printResult(result, opts);
      }),
    );

  program
    .command("group-member-remove")
    .description("Remove a member from a group")
    .requiredOption("--group-id <id>", "Group ID")
    .requiredOption("--user-id <id>", "User ID to remove")
    .action((options: { groupId: string; userId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.removeGroupMember(options.groupId, options.userId);
        printResult(result, opts);
      }),
    );
}

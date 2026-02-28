import { Command, Option } from "commander";
import {
  CliError,
  ensureOutputSupported,
  printResult,
  withClient,
} from "../lib/cli-utils.js";

export function register(program: Command) {
  program
    .command("user-me")
    .description("Get current user information")
    .action(() =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getCurrentUser();
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("user-update")
    .description("Update current user settings")
    .option("--name <name>", "User display name")
    .option("--email <email>", "User email")
    .option("--avatar-url <url>", "Avatar URL")
    .addOption(new Option("--full-page-width <bool>", "Enable full page width").choices(["true", "false"]))
    .addOption(
      new Option("--page-edit-mode <mode>", "Default page edit mode")
        .choices(["read", "edit"]),
    )
    .option("--locale <locale>", "User locale")
    .action(
      (options: {
        name?: string;
        email?: string;
        avatarUrl?: string;
        fullPageWidth?: string;
        pageEditMode?: string;
        locale?: string;
      }) =>
        withClient(program, async (client, opts) => {
          ensureOutputSupported(opts);
          const params: Record<string, unknown> = {
            ...(options.name !== undefined && { name: options.name }),
            ...(options.email !== undefined && { email: options.email }),
            ...(options.avatarUrl !== undefined && { avatarUrl: options.avatarUrl }),
            ...(options.fullPageWidth !== undefined && { fullPageWidth: options.fullPageWidth === "true" }),
            ...(options.pageEditMode !== undefined && { pageEditMode: options.pageEditMode }),
            ...(options.locale !== undefined && { locale: options.locale }),
          };

          if (Object.keys(params).length === 0) {
            throw new CliError(
              "VALIDATION_ERROR",
              "At least one update flag is required.",
            );
          }

          const result = await client.updateUser(params);
          printResult(result, opts);
        }),
    );
}

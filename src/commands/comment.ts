import { Command } from "commander";
import {
  ensureOutputSupported,
  printResult,
  resolveContentInput,
  withClient,
} from "../lib/cli-utils.js";

export function register(program: Command) {
  program
    .command("comment-list")
    .description("List comments on a page")
    .requiredOption("--page-id <id>", "Page ID")
    .action((options: { pageId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts, { allowTable: true });
        const result = await client.getComments(options.pageId);
        printResult(result, opts, { allowTable: true });
      }),
    );

  program
    .command("comment-info")
    .description("Get comment by ID")
    .requiredOption("--comment-id <id>", "Comment ID")
    .action((options: { commentId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.getCommentInfo(options.commentId);
        printResult(result, opts);
      }),
    );

  program
    .command("comment-create")
    .description("Create a comment on a page")
    .requiredOption("--page-id <id>", "Page ID")
    .requiredOption("--content <content>", "Content literal, @file, or - for stdin")
    .option("--selection <text>", "Selected text the comment refers to")
    .option("--parent-comment-id <id>", "Parent comment ID for replies")
    .action(
      (options: {
        pageId: string;
        content: string;
        selection?: string;
        parentCommentId?: string;
      }) =>
        withClient(program, async (client, opts) => {
          ensureOutputSupported(opts);
          const content = await resolveContentInput(options.content);
          const result = await client.createComment(
            options.pageId,
            content,
            options.selection,
            options.parentCommentId,
          );
          printResult(result, opts);
        }),
    );

  program
    .command("comment-update")
    .description("Update a comment")
    .requiredOption("--comment-id <id>", "Comment ID")
    .requiredOption("--content <content>", "Content literal, @file, or - for stdin")
    .action((options: { commentId: string; content: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const content = await resolveContentInput(options.content);
        const result = await client.updateComment(options.commentId, content);
        printResult(result, opts);
      }),
    );

  program
    .command("comment-delete")
    .description("Delete a comment")
    .requiredOption("--comment-id <id>", "Comment ID")
    .action((options: { commentId: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.deleteComment(options.commentId);
        printResult(result, opts);
      }),
    );
}

import { writeFileSync } from "fs";
import { Command } from "commander";
import {
  ensureOutputSupported,
  printResult,
  withClient,
} from "../lib/cli-utils.js";

export function register(program: Command) {
  program
    .command("file-upload")
    .description("Upload a file attachment to a page")
    .requiredOption("--file <path>", "File to upload")
    .requiredOption("--page-id <id>", "Page ID to attach file to")
    .option("--attachment-id <id>", "Existing attachment ID to replace")
    .action((options: { file: string; pageId: string; attachmentId?: string }) =>
      withClient(program, async (client, opts) => {
        ensureOutputSupported(opts);
        const result = await client.uploadFile(options.file, options.pageId, options.attachmentId);
        printResult(result, opts);
      }),
    );

  program
    .command("file-download")
    .description("Download a file attachment")
    .requiredOption("--file-id <id>", "File ID")
    .requiredOption("--file-name <name>", "File name")
    .option("--output <path>", "Output file path")
    .action((options: { fileId: string; fileName: string; output?: string }) =>
      withClient(program, async (client) => {
        const data = await client.downloadFile(options.fileId, options.fileName);
        if (options.output) {
          writeFileSync(options.output, Buffer.from(data));
        } else {
          process.stdout.write(Buffer.from(data));
        }
      }),
    );
}

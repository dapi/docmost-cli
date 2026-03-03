import { Command } from "commander";

export function register(program: Command) {
  program
    .command("commands")
    .description("List all available commands with options (for agent discovery)")
    .action(() => {
      const commands = program.commands
        .filter((cmd) => cmd.name() !== "commands")
        .map((cmd) => ({
          name: cmd.name(),
          description: cmd.description(),
          options: cmd.options.map((opt) => ({
            flags: opt.flags,
            description: opt.description,
            required: opt.required || false,
            ...(opt.defaultValue !== undefined && { default: opt.defaultValue }),
          })),
        }));

      const envelope = { ok: true, data: commands, meta: { count: commands.length, hasMore: false } };
      console.log(JSON.stringify(envelope, null, 2));
    });
}

import { Argument, Option, program } from "commander";
import { releaseWorkspacePackage } from "./release.ts";
import { parseTypedTarget, parseTypedVersion } from "../typed-inputs/typed-inputs.ts";

program
  .name("workspace-release")
  .description("Preview or create a workspace package release.")
  .addArgument(
    new Argument(
      "[release]",
      "Package selector or package=version, for example workspace-tools or workspace-tools=patch",
    ),
  )
  .addOption(
    new Option("--mode <mode>", "Version mode").choices([
      "bump",
      "exact",
      "package-json",
    ]),
  )
  .option("--version <version>", "Override the version or bump")
  .option("--selection <selection>", "Typed version selection, e.g. bump:minor")
  .option("--target <selection>", "Typed package target, e.g. directory:packages/foo")
  .option(
    "--resolve-only",
    "Resolve the next version without release checks or side effects",
  )
  .option("-d, --dry-run", "Preview without changing repository files")
  .option("-j, --json", "Print the operation result as JSON")
  .option("--no-fzf", "Disable automatic fzf selection")
  .action(async (release, options) => {
    if (options.selection) {
      const selected = parseTypedVersion(options.selection);
      if (selected.mode === "auto") throw new Error("workspace-release requires an explicit version selection");
      options.mode = selected.mode;
      options.version = selected.exactVersion ?? selected.bump;
    }
    if (options.target) {
      const target = parseTypedTarget(options.target);
      if (target.kind === "package" || target.kind === "directory") release = target.value;
      else release = ".";
    }
    await releaseWorkspacePackage(release, options);
  });

await program.parseAsync();

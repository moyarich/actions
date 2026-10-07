import { Argument, Option, program } from "commander";
import { releaseIdentity } from "../release-identity/release-identity.ts";
import { resolveRestoreSource } from "../release-identity/restore-source.ts";
import { packageInfo, repositoryRoot } from "../workspace/workspace.ts";

const restoreSourceMode = process.argv[2] === "restore-source";

program
  .name("workspace-release-identity")
  .description(
    "Resolve canonical workspace package release identity and historical restore sources.",
  );

if (restoreSourceMode) {
  program
    .addArgument(
      new Argument(
        "<source>",
        "commit:<sha>, tag:<tag>, run:<id>, artifact:<id>, or github-url:<url>",
      ),
    )
    .requiredOption(
      "--repository <owner/name>",
      "GitHub repository used for run, artifact, and github-url resolution",
    )
    .option("--json", "Print compact JSON")
    .option("--pretty-json", "Print formatted JSON")
    .action((source, options) => {
      const resolution = resolveRestoreSource(source, options.repository);

      if (options.json) process.stdout.write(JSON.stringify(resolution));
      else if (options.prettyJson)
        process.stdout.write(`${JSON.stringify(resolution, null, 2)}\n`);
      else {
        process.stdout.write(
          [
            `Source: ${resolution.source}`,
            `Kind: ${resolution.kind}`,
            `Resolved kind: ${resolution.resolvedKind}`,
            `Value: ${resolution.value}`,
            `Commit: ${resolution.commit}`,
            "",
          ].join("\n"),
        );
      }
    });

  await program.parseAsync([
    process.argv[0]!,
    process.argv[1]!,
    ...process.argv.slice(3),
  ]);
} else {
  program
    .addArgument(new Argument("<package>", "Workspace package selector"))
    .addOption(
      new Option(
        "--version <version>",
        "Version or release-template token to use",
      ),
    )
    .option("--json", "Print compact JSON")
    .option("--pretty-json", "Print formatted JSON")
    .action((selector, options) => {
      const pkg = packageInfo(repositoryRoot(), selector);
      const identity = releaseIdentity(
        pkg,
        options.version ?? pkg.manifest.version,
      );

      if (options.json) process.stdout.write(JSON.stringify(identity));
      else if (options.prettyJson)
        process.stdout.write(`${JSON.stringify(identity, null, 2)}\n`);
      else {
        process.stdout.write(
          [
            `Package: ${identity.packageName}`,
            `Directory: ${identity.packageDirectory}`,
            `Version: ${identity.version}`,
            `Tag: ${identity.tagName}`,
            `Release: ${identity.releaseName}`,
            "",
          ].join("\n"),
        );
      }
    });

  await program.parseAsync();
}

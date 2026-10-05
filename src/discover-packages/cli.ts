#!/usr/bin/env node
import { Argument, Option, program } from "commander";
import { discoverPackages } from "../core";

program
  .name("discover-packages")
  .description("Discover repository packages and package metadata.")
  .addArgument(
    new Argument("[directory]", "Packages directory").default("packages"),
  )
  .option("--workspaces", "Discover from package.json workspace patterns")
  .option("--include-root-package", "Include the repository root package")
  .option("--include-private", "Include private packages")
  .option("--require-publish-config", "Only include publishable packages")
  .option("--require-test-script", "Only include packages with a test script")
  .option("--require-build-script", "Only include packages with a build script")
  .addOption(
    new Option("--format <format>", "Output format").choices([
      "text",
      "json",
      "pretty-json",
    ]),
  )
  .option("--json", "Print compact JSON")
  .option("--pretty-json", "Print formatted JSON")
  .action((directory, options) => {
    const packages = discoverPackages({
      packagesDirectory: directory,
      useWorkspaces: Boolean(options.workspaces),
      includeRootPackage: Boolean(options.includeRootPackage),
      includePrivate: Boolean(options.includePrivate),
      requirePublishConfig: Boolean(options.requirePublishConfig),
      requireTestScript: Boolean(options.requireTestScript),
      requireBuildScript: Boolean(options.requireBuildScript),
    });

    const format = options.json
      ? "json"
      : options.prettyJson
        ? "pretty-json"
        : (options.format ?? (process.stdout.isTTY ? "text" : "json"));

    if (format === "json") process.stdout.write(JSON.stringify(packages));
    else if (format === "pretty-json")
      process.stdout.write(`${JSON.stringify(packages, null, 2)}\n`);
    else if (!packages.length) process.stdout.write("No packages found.\n");
    else {
      process.stdout.write(`Packages (${packages.length}):\n\n`);
      for (const pkg of packages) {
        process.stdout.write(
          `  ${pkg.name}@${pkg.version}\n    ${pkg.directory}\n`,
        );
      }
    }
  });

await program.parseAsync();

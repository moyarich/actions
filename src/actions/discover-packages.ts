import { appendFileSync } from "node:fs";
import process from "node:process";
import {
  discoverPackages,
  packageMatrix,
  type DiscoverPackagesOptions,
} from "../discover-packages/discover-packages";

function input(name: string): string {
  const suffix = name.toUpperCase();
  return (
    process.env[`INPUT_${suffix}`] ??
    process.env[`INPUT_${suffix.replaceAll("-", "_")}`] ??
    ""
  );
}

function booleanInput(name: string): boolean {
  return input(name) === "true";
}

function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) appendFileSync(outputFile, `${name}=${value}\n`);
}

function writeSummary(
  options: DiscoverPackagesOptions,
  packages: ReturnType<typeof discoverPackages>,
): void {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  appendFileSync(
    summaryFile,
    [
      "# Package discovery",
      "",
      "| Setting | Value |",
      "| --- | --- |",
      `| Packages directory | \`${options.packagesDirectory}\` |`,
      `| Use workspaces | **${options.useWorkspaces}** |`,
      `| Include root package | **${options.includeRootPackage}** |`,
      `| Include private | **${options.includePrivate}** |`,
      `| Require publish config | **${options.requirePublishConfig}** |`,
      `| Require test script | **${options.requireTestScript}** |`,
      `| Require build script | **${options.requireBuildScript}** |`,
      `| Count | **${packages.length}** |`,
      "",
      "~~~json",
      JSON.stringify(packages, null, 2),
      "~~~",
      "",
    ].join("\n"),
  );
}

export function runAction(): void {
  const options: DiscoverPackagesOptions = {
    packagesDirectory: input("packages-directory") || "packages",
    useWorkspaces: booleanInput("use-workspaces"),
    includeRootPackage: booleanInput("include-root-package"),
    includePrivate: booleanInput("include-private"),
    requirePublishConfig: booleanInput("require-publish-config"),
    requireTestScript: booleanInput("require-test-script"),
    requireBuildScript: booleanInput("require-build-script"),
  };

  const packages = discoverPackages(options);
  const packagesJson = JSON.stringify(packages);

  setOutput("packages", packagesJson);
  setOutput("matrix", JSON.stringify(packageMatrix(packages)));
  setOutput("count", String(packages.length));
  setOutput("has-packages", String(packages.length > 0));
  writeSummary(options, packages);
}


function runEntryPoint(): void {
  try {
    runAction();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`discover-packages: ${message}\n`);
    process.exitCode = 1;
  }
}

if (process.env.GITHUB_ACTIONS === "true") {
  runEntryPoint();
}

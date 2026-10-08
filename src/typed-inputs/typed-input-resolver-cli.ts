import { Command } from "commander";
import {
  parseTypedRelease,
  parseTypedSource,
  parseTypedTarget,
  parseTypedVersion,
} from "./typed-inputs.ts";

const program = new Command();
program
  .name("typed-input-resolver")
  .description("Parse and validate typed workflow inputs.");
program
  .option(
    "--version <selection>",
    "auto, package-json, bump:minor, exact:1.2.3",
    "auto",
  )
  .option(
    "--target <selection>",
    "repository, package:name, directory:path",
    "repository",
  )
  .option(
    "--workspace-tools <selection>",
    "workspace, registry:version, repository:ref",
    "registry:0.1.0",
  )
  .option("--release <selection>", "auto, tag:name, name:title", "auto")
  .option("--json", "Print JSON")
  .option("--github-output", "Append normalized values to GITHUB_OUTPUT")
  .action(async (options) => {
    const version = parseTypedVersion(options.version);
    const target = parseTypedTarget(options.target);
    const source = parseTypedSource(options.workspaceTools);
    const release = parseTypedRelease(options.release);
    const result = {
      versionMode: version.mode,
      versionBump: version.bump ?? "",
      exactVersion: version.exactVersion ?? "",
      packageName: target.kind === "package" ? target.value : "",
      packageDirectory: target.kind === "directory" ? target.value : "",
      workspaceToolsSource: source.source,
      workspaceToolsVersion: source.source === "registry" ? source.value : "",
      workspaceToolsRef: source.source === "repository" ? source.value : "",
      releaseTag: release.kind === "tag" ? release.value : "",
      releaseName: release.kind === "name" ? release.value : "",
    };
    if (options.githubOutput) {
      const { appendFileSync } = await import("node:fs");
      if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is not set");
      appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(result).map(([key, value]) => `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}=${value ?? ""}\n`).join(""));
    }
    console.log(JSON.stringify(result, null, options.json ? 0 : 2));
  });
await program.parseAsync();

import { readFileSync } from "node:fs";
import { Command } from "commander";
import { resolveVersionSelection } from "./sim-version-resolver.ts";

const program = new Command();
program
  .name("sim-version-resolver")
  .description(
    "Resolve a semantic version without modifying files or publishing.",
  )
  .option(
    "--current-version <version>",
    "Current version; defaults to selected package manifest",
  )
  .option("--package-json <path>", "Package manifest path", "package.json")
  .option("--mode <mode>", "Version mode: bump, package-json, exact", "bump")
  .option(
    "--selection <selection>",
    "Typed selection, e.g. bump:minor or exact:1.2.3",
  )
  .option("--bump <type>", "Version increment", "patch")
  .option("--exact-version <version>", "Exact version when --mode exact")
  .option("--json", "Output a machine-readable JSON object")
  .action((opts) => {
    if (!["bump", "package-json", "exact"].includes(opts.mode)) {
      throw new Error(`Invalid version mode: ${opts.mode}`);
    }
    let currentVersion = opts.currentVersion;
    if (!currentVersion) {
      const manifest = JSON.parse(readFileSync(opts.packageJson, "utf8"));
      currentVersion = manifest.version;
    }
    const nextVersion = resolveVersionSelection(
      currentVersion,
      opts.mode,
      opts.bump,
      opts.exactVersion || "",
    );
    const result = {
      currentVersion,
      nextVersion,
      mode: opts.mode,
      ...(opts.mode === "bump" ? { bump: opts.bump } : {}),
    };
    console.log(opts.json ? JSON.stringify(result) : nextVersion);
  });
await program.parseAsync();

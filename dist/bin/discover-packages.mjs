#!/usr/bin/env node
import { program, Argument, Option } from "commander";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
function readManifest(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}
function packageFromManifest(directory, manifest, fallbackName) {
  return {
    directory,
    name: manifest.name ?? fallbackName,
    version: manifest.version ?? "0.0.0",
    private: manifest.private === true,
    publishable: manifest.private !== true && typeof manifest.publishConfig?.registry === "string",
    hasTest: typeof manifest.scripts?.test === "string",
    hasBuild: typeof manifest.scripts?.build === "string"
  };
}
function matchesFilters(pkg, options) {
  if (!options.includePrivate && pkg.private) return false;
  if (options.requirePublishConfig && !pkg.publishable) return false;
  if (options.requireTestScript && !pkg.hasTest) return false;
  if (options.requireBuildScript && !pkg.hasBuild) return false;
  return true;
}
function discoverWorkspacePackages(options) {
  if (!existsSync("package.json")) return [];
  const root = readManifest("package.json");
  const raw = Array.isArray(root.workspaces) ? root.workspaces : Array.isArray(root.workspaces?.packages) ? root.workspaces.packages : [];
  const patterns = raw.map((value) => String(value).replace(/\/$/, "")).filter(Boolean);
  const files = /* @__PURE__ */ new Set();
  for (const pattern of patterns) {
    const output = execFileSync(
      "git",
      ["ls-files", "--cached", "-z", "--", `:(glob)${pattern}/package.json`],
      { encoding: "utf8" }
    );
    for (const file of output.split("\0").filter(Boolean)) {
      files.add(file);
    }
  }
  return [...files].map((file) => {
    const directory = path.posix.dirname(file);
    return packageFromManifest(
      directory,
      readManifest(file),
      path.posix.basename(directory)
    );
  }).filter((pkg) => matchesFilters(pkg, options));
}
function discoverDirectoryPackages(options) {
  if (!existsSync(options.packagesDirectory)) return [];
  const packages = [];
  for (const entry of readdirSync(options.packagesDirectory, {
    withFileTypes: true
  })) {
    if (!entry.isDirectory()) continue;
    const directory = path.posix.join(options.packagesDirectory, entry.name);
    const manifestPath = path.posix.join(directory, "package.json");
    if (!existsSync(manifestPath)) continue;
    const pkg = packageFromManifest(
      directory,
      readManifest(manifestPath),
      entry.name
    );
    if (matchesFilters(pkg, options)) {
      packages.push(pkg);
    }
  }
  return packages;
}
function discoverRootPackage(options) {
  if (!options.includeRootPackage || !existsSync("package.json")) return null;
  const manifest = readManifest("package.json");
  if (typeof manifest.name !== "string") return null;
  const pkg = packageFromManifest(".", manifest, manifest.name);
  return matchesFilters(pkg, options) ? pkg : null;
}
function discoverPackages(options) {
  const packages = options.useWorkspaces ? discoverWorkspacePackages(options) : discoverDirectoryPackages(options);
  const root = discoverRootPackage(options);
  if (root) packages.unshift(root);
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}
program.name("discover-packages").description("Discover repository packages and package metadata.").addArgument(
  new Argument("[directory]", "Packages directory").default("packages")
).option("--workspaces", "Discover from package.json workspace patterns").option("--include-root-package", "Include the repository root package").option("--include-private", "Include private packages").option("--require-publish-config", "Only include publishable packages").option("--require-test-script", "Only include packages with a test script").option("--require-build-script", "Only include packages with a build script").addOption(
  new Option("--format <format>", "Output format").choices([
    "text",
    "json",
    "pretty-json"
  ])
).option("--json", "Print compact JSON").option("--pretty-json", "Print formatted JSON").action((directory, options) => {
  const packages = discoverPackages({
    packagesDirectory: directory,
    useWorkspaces: Boolean(options.workspaces),
    includeRootPackage: Boolean(options.includeRootPackage),
    includePrivate: Boolean(options.includePrivate),
    requirePublishConfig: Boolean(options.requirePublishConfig),
    requireTestScript: Boolean(options.requireTestScript),
    requireBuildScript: Boolean(options.requireBuildScript)
  });
  const format = options.json ? "json" : options.prettyJson ? "pretty-json" : options.format ?? (process.stdout.isTTY ? "text" : "json");
  if (format === "json") process.stdout.write(JSON.stringify(packages));
  else if (format === "pretty-json")
    process.stdout.write(`${JSON.stringify(packages, null, 2)}
`);
  else if (!packages.length) process.stdout.write("No packages found.\n");
  else {
    process.stdout.write(`Packages (${packages.length}):

`);
    for (const pkg of packages) {
      process.stdout.write(
        `  ${pkg.name}@${pkg.version}
    ${pkg.directory}
`
      );
    }
  }
});
await program.parseAsync();

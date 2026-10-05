import process from "node:process";
import { existsSync, readdirSync, readFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
function packageMatrix(packages) {
  return { include: packages };
}
function input(name) {
  const suffix = name.toUpperCase();
  return process.env[`INPUT_${suffix}`] ?? process.env[`INPUT_${suffix.replaceAll("-", "_")}`] ?? "";
}
function booleanInput(name) {
  return input(name) === "true";
}
function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) appendFileSync(outputFile, `${name}=${value}
`);
}
function writeSummary(options, packages) {
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
      ""
    ].join("\n")
  );
}
function runAction() {
  const options = {
    packagesDirectory: input("packages-directory") || "packages",
    useWorkspaces: booleanInput("use-workspaces"),
    includeRootPackage: booleanInput("include-root-package"),
    includePrivate: booleanInput("include-private"),
    requirePublishConfig: booleanInput("require-publish-config"),
    requireTestScript: booleanInput("require-test-script"),
    requireBuildScript: booleanInput("require-build-script")
  };
  const packages = discoverPackages(options);
  const packagesJson = JSON.stringify(packages);
  setOutput("packages", packagesJson);
  setOutput("matrix", JSON.stringify(packageMatrix(packages)));
  setOutput("count", String(packages.length));
  setOutput("has-packages", String(packages.length > 0));
  writeSummary(options, packages);
}
try {
  runAction();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`discover-packages: ${message}
`);
  process.exitCode = 1;
}

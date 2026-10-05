import process$1 from "node:process";
import { existsSync, readdirSync, readFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}
function toPackage(directory, manifest) {
  return {
    directory,
    name: manifest.name ?? path.posix.basename(directory),
    version: manifest.version ?? "0.0.0",
    private: manifest.private === true,
    publishable: manifest.private !== true && typeof manifest.publishConfig?.registry === "string",
    hasTest: typeof manifest.scripts?.test === "string",
    hasBuild: typeof manifest.scripts?.build === "string"
  };
}
function matches(pkg, options) {
  if (!options.includePrivate && pkg.private) return false;
  if (options.requirePublishConfig && !pkg.publishable) return false;
  if (options.requireTestScript && !pkg.hasTest) return false;
  if (options.requireBuildScript && !pkg.hasBuild) return false;
  return true;
}
function discoverWorkspaceFiles(cwd, root) {
  const raw = Array.isArray(root.workspaces) ? root.workspaces : Array.isArray(root.workspaces?.packages) ? root.workspaces.packages : [];
  const files = /* @__PURE__ */ new Set();
  for (const value of raw.map(String).map((v) => v.replace(/\/$/, "")).filter(Boolean)) {
    const output = execFileSync(
      "git",
      ["ls-files", "--cached", "-z", "--", `:(glob)${value}/package.json`],
      { cwd, encoding: "utf8" }
    );
    for (const file of output.split("\0").filter(Boolean)) files.add(file);
  }
  return [...files];
}
function discoverPackages(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const packagesDirectory = options.packagesDirectory ?? "packages";
  const rootPath = path.join(cwd, "package.json");
  const root = existsSync(rootPath) ? readJson(rootPath) : {};
  const files = options.useWorkspaces ? discoverWorkspaceFiles(cwd, root) : (() => {
    const directory = path.join(cwd, packagesDirectory);
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map(
      (entry) => path.posix.join(packagesDirectory, entry.name, "package.json")
    ).filter((file) => existsSync(path.join(cwd, file)));
  })();
  const packages = files.map((file) => {
    const directory = path.posix.dirname(file);
    return toPackage(directory, readJson(path.join(cwd, file)));
  }).filter((pkg) => matches(pkg, options));
  if (options.includeRootPackage && existsSync(rootPath) && typeof root.name === "string") {
    const rootPackage = toPackage(".", root);
    if (matches(rootPackage, options)) packages.unshift(rootPackage);
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name));
}
const enabled = (name) => process$1.env[name] === "true";
function runAction() {
  const packages = discoverPackages({
    packagesDirectory: process$1.env.PACKAGES_DIRECTORY || "packages",
    useWorkspaces: enabled("USE_WORKSPACES"),
    includeRootPackage: enabled("INCLUDE_ROOT_PACKAGE"),
    includePrivate: enabled("INCLUDE_PRIVATE"),
    requirePublishConfig: enabled("REQUIRE_PUBLISH_CONFIG"),
    requireTestScript: enabled("REQUIRE_TEST_SCRIPT"),
    requireBuildScript: enabled("REQUIRE_BUILD_SCRIPT")
  });
  const packagesJson = JSON.stringify(packages);
  const matrixJson = JSON.stringify({ include: packages });
  const count = packages.length;
  const output = [
    `packages=${packagesJson}`,
    `matrix=${matrixJson}`,
    `count=${count}`,
    `has-packages=${count > 0}`,
    ""
  ].join("\n");
  if (!process$1.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
  appendFileSync(process$1.env.GITHUB_OUTPUT, output);
  if (process$1.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process$1.env.GITHUB_STEP_SUMMARY,
      [
        "# Package discovery",
        "",
        `Found **${count}** package(s).`,
        "",
        "~~~json",
        JSON.stringify(packages, null, 2),
        "~~~",
        ""
      ].join("\n")
    );
  }
}
try {
  runAction();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process$1.stderr.write(`discover-packages: ${message}
`);
  process$1.exitCode = 1;
}

#!/usr/bin/env node
import { program, Argument, Option } from "commander";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
function releaseIdentity(pkg, version = pkg.manifest.version) {
  const packageName = pkg.manifest.name?.trim();
  const packageDirectory = pkg.directory.replace(/^\.\//, "").replace(/\/$/, "");
  const resolvedVersion = version?.trim();
  if (!packageName) {
    throw new Error("Package name is required for release identity.");
  }
  if (!packageDirectory) {
    throw new Error("Package directory is required for release identity.");
  }
  if (!resolvedVersion) {
    throw new Error("Version is required for release identity.");
  }
  return {
    packageName,
    packageDirectory,
    version: resolvedVersion,
    tagName: `${packageDirectory}@${resolvedVersion}`,
    tagPrefix: `${packageDirectory}@`,
    releaseName: `${packageName} v${resolvedVersion}`
  };
}
function workspacePatterns(root) {
  const manifest = JSON.parse(
    readFileSync(resolve(root, "package.json"), "utf8")
  );
  const workspaces = Array.isArray(manifest.workspaces) ? manifest.workspaces : manifest.workspaces?.packages;
  if (!Array.isArray(workspaces)) return [];
  return workspaces;
}
function workspacePackages(root) {
  const directories = workspacePatterns(root).flatMap((pattern) => {
    const normalized = pattern.replace(/^\.\//, "").replace(/\/$/, "");
    if (!normalized.endsWith("/*")) {
      return existsSync(resolve(root, normalized, "package.json")) ? [normalized] : [];
    }
    const parent = normalized.slice(0, -2);
    const parentDir = resolve(root, parent);
    if (!existsSync(parentDir)) return [];
    return readdirSync(parentDir, { withFileTypes: true }).filter(
      (entry) => entry.isDirectory() && existsSync(resolve(parentDir, entry.name, "package.json"))
    ).map((entry) => `${parent}/${entry.name}`);
  });
  return [...new Set(directories)].map((directory) => {
    const file = resolve(root, directory, "package.json");
    const manifest = JSON.parse(
      readFileSync(file, "utf8")
    );
    return { directory, file, manifest };
  }).filter(
    (pkg) => typeof pkg.manifest.name === "string" && typeof pkg.manifest.version === "string"
  );
}
function packageInfo(root, selector) {
  const packages = workspacePackages(root);
  const normalized = selector?.replace(/^\.\//, "");
  if (!normalized || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../") || normalized.endsWith("/..")) {
    throw new Error(
      `Package selector must identify a workspace package: ${selector}`
    );
  }
  const pkg = packages.find(
    ({ directory, manifest }) => normalized === directory || normalized === directory.split("/").at(-1) || normalized === manifest.name
  );
  if (!pkg) throw new Error(`Package not found: ${selector}`);
  return pkg;
}
function repositoryRoot() {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}
program.name("workspace-release-identity").description(
  "Resolve the canonical Git tag and GitHub Release name for a workspace package."
).addArgument(new Argument("<package>", "Workspace package selector")).addOption(
  new Option(
    "--version <version>",
    "Version or release-template token to use"
  )
).option("--json", "Print compact JSON").option("--pretty-json", "Print formatted JSON").action((selector, options) => {
  const pkg = packageInfo(repositoryRoot(), selector);
  const identity = releaseIdentity(
    pkg,
    options.version ?? pkg.manifest.version
  );
  if (options.json) process.stdout.write(JSON.stringify(identity));
  else if (options.prettyJson)
    process.stdout.write(`${JSON.stringify(identity, null, 2)}
`);
  else {
    process.stdout.write(
      [
        `Package: ${identity.packageName}`,
        `Directory: ${identity.packageDirectory}`,
        `Version: ${identity.version}`,
        `Tag: ${identity.tagName}`,
        `Release: ${identity.releaseName}`,
        ""
      ].join("\n")
    );
  }
});
await program.parseAsync();

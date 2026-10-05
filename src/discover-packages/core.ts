import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type DiscoverPackagesOptions = {
  cwd?: string;
  packagesDirectory?: string;
  useWorkspaces?: boolean;
  includeRootPackage?: boolean;
  includePrivate?: boolean;
  requirePublishConfig?: boolean;
  requireTestScript?: boolean;
  requireBuildScript?: boolean;
};

export type DiscoveredPackage = {
  directory: string;
  name: string;
  version: string;
  private: boolean;
  publishable?: boolean;
  hasTest?: boolean;
  hasBuild?: boolean;
};

type PackageJson = {
  name?: string;
  version?: string;
  private?: boolean;
  workspaces?: string[] | { packages?: string[] };
  publishConfig?: { registry?: string };
  scripts?: Record<string, string>;
};

function readJson(file: string): PackageJson {
  return JSON.parse(readFileSync(file, "utf8")) as PackageJson;
}

function toPackage(directory: string, manifest: PackageJson): DiscoveredPackage {
  return {
    directory,
    name: manifest.name ?? path.posix.basename(directory),
    version: manifest.version ?? "0.0.0",
    private: manifest.private === true,
    publishable:
      manifest.private !== true &&
      typeof manifest.publishConfig?.registry === "string",
    hasTest: typeof manifest.scripts?.test === "string",
    hasBuild: typeof manifest.scripts?.build === "string",
  };
}

function matches(pkg: DiscoveredPackage, options: DiscoverPackagesOptions) {
  if (!options.includePrivate && pkg.private) return false;
  if (options.requirePublishConfig && !pkg.publishable) return false;
  if (options.requireTestScript && !pkg.hasTest) return false;
  if (options.requireBuildScript && !pkg.hasBuild) return false;
  return true;
}

function discoverWorkspaceFiles(cwd: string, root: PackageJson) {
  const raw = Array.isArray(root.workspaces)
    ? root.workspaces
    : Array.isArray(root.workspaces?.packages)
      ? root.workspaces.packages
      : [];

  const files = new Set<string>();
  for (const value of raw.map(String).map((v) => v.replace(/\/$/, "")).filter(Boolean)) {
    const output = execFileSync(
      "git",
      ["ls-files", "--cached", "-z", "--", `:(glob)${value}/package.json`],
      { cwd, encoding: "utf8" },
    );
    for (const file of output.split("\0").filter(Boolean)) files.add(file);
  }
  return [...files];
}

export function discoverPackages(options: DiscoverPackagesOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const packagesDirectory = options.packagesDirectory ?? "packages";
  const rootPath = path.join(cwd, "package.json");
  const root = existsSync(rootPath) ? readJson(rootPath) : {};

  const files = options.useWorkspaces
    ? discoverWorkspaceFiles(cwd, root)
    : (() => {
        const directory = path.join(cwd, packagesDirectory);
        if (!existsSync(directory)) return [];
        return readdirSync(directory, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => path.posix.join(packagesDirectory, entry.name, "package.json"))
          .filter((file) => existsSync(path.join(cwd, file)));
      })();

  const packages = files
    .map((file) => {
      const directory = path.posix.dirname(file);
      return toPackage(directory, readJson(path.join(cwd, file)));
    })
    .filter((pkg) => matches(pkg, options));

  if (options.includeRootPackage && existsSync(rootPath) && typeof root.name === "string") {
    const rootPackage = toPackage(".", root);
    if (matches(rootPackage, options)) packages.unshift(rootPackage);
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type DiscoverPackagesOptions = {
  packagesDirectory: string;
  useWorkspaces: boolean;
  includeRootPackage: boolean;
  includePrivate: boolean;
  requirePublishConfig: boolean;
  requireTestScript: boolean;
  requireBuildScript: boolean;
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

function readManifest(file: string): Record<string, any> {
  return JSON.parse(readFileSync(file, "utf8"));
}

function packageFromManifest(
  directory: string,
  manifest: Record<string, any>,
  fallbackName: string,
): DiscoveredPackage {
  return {
    directory,
    name: manifest.name ?? fallbackName,
    version: manifest.version ?? "0.0.0",
    private: manifest.private === true,
    publishable:
      manifest.private !== true &&
      typeof manifest.publishConfig?.registry === "string",
    hasTest: typeof manifest.scripts?.test === "string",
    hasBuild: typeof manifest.scripts?.build === "string",
  };
}

function matchesFilters(
  pkg: DiscoveredPackage,
  options: DiscoverPackagesOptions,
): boolean {
  if (!options.includePrivate && pkg.private) return false;
  if (options.requirePublishConfig && !pkg.publishable) return false;
  if (options.requireTestScript && !pkg.hasTest) return false;
  if (options.requireBuildScript && !pkg.hasBuild) return false;
  return true;
}

function discoverWorkspacePackages(
  options: DiscoverPackagesOptions,
): DiscoveredPackage[] {
  if (!existsSync("package.json")) return [];

  const root = readManifest("package.json");
  const raw = Array.isArray(root.workspaces)
    ? root.workspaces
    : Array.isArray(root.workspaces?.packages)
      ? root.workspaces.packages
      : [];

  const patterns = raw
    .map((value: unknown) => String(value).replace(/\/$/, ""))
    .filter(Boolean);

  const files = new Set<string>();

  for (const pattern of patterns) {
    const output = execFileSync(
      "git",
      ["ls-files", "--cached", "-z", "--", `:(glob)${pattern}/package.json`],
      { encoding: "utf8" },
    );

    for (const file of output.split("\0").filter(Boolean)) {
      files.add(file);
    }
  }

  return [...files]
    .map((file) => {
      const directory = path.posix.dirname(file);
      return packageFromManifest(
        directory,
        readManifest(file),
        path.posix.basename(directory),
      );
    })
    .filter((pkg) => matchesFilters(pkg, options));
}

function discoverDirectoryPackages(
  options: DiscoverPackagesOptions,
): DiscoveredPackage[] {
  if (!existsSync(options.packagesDirectory)) return [];

  const packages: DiscoveredPackage[] = [];

  for (const entry of readdirSync(options.packagesDirectory, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;

    const directory = path.posix.join(options.packagesDirectory, entry.name);
    const manifestPath = path.posix.join(directory, "package.json");

    if (!existsSync(manifestPath)) continue;

    const pkg = packageFromManifest(
      directory,
      readManifest(manifestPath),
      entry.name,
    );

    if (matchesFilters(pkg, options)) {
      packages.push(pkg);
    }
  }

  return packages;
}

function discoverRootPackage(
  options: DiscoverPackagesOptions,
): DiscoveredPackage | null {
  if (!options.includeRootPackage || !existsSync("package.json")) return null;

  const manifest = readManifest("package.json");
  if (typeof manifest.name !== "string") return null;

  const pkg = packageFromManifest(".", manifest, manifest.name);
  return matchesFilters(pkg, options) ? pkg : null;
}

export function discoverPackages(
  options: DiscoverPackagesOptions,
): DiscoveredPackage[] {
  const packages = options.useWorkspaces
    ? discoverWorkspacePackages(options)
    : discoverDirectoryPackages(options);

  const root = discoverRootPackage(options);
  if (root) packages.unshift(root);

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

export function packageMatrix(packages: DiscoveredPackage[]) {
  return { include: packages };
}

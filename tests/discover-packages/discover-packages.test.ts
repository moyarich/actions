import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  discoverPackages,
  packageMatrix,
  type DiscoverPackagesOptions,
} from "../../src/discover-packages/discover-packages";

const originalCwd = process.cwd();
const tempDirectories: string[] = [];

function makeRepo(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "discover-packages-"));
  tempDirectories.push(directory);
  process.chdir(directory);
  execFileSync("git", ["init", "-q"]);
  return directory;
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2));
}

function options(
  overrides: Partial<DiscoverPackagesOptions> = {},
): DiscoverPackagesOptions {
  return {
    packagesDirectory: "packages",
    useWorkspaces: false,
    includeRootPackage: false,
    includePrivate: false,
    requirePublishConfig: false,
    requireTestScript: false,
    requireBuildScript: false,
    ...overrides,
  };
}

beforeEach(() => {
  process.chdir(originalCwd);
});

afterEach(() => {
  process.chdir(originalCwd);

  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("discoverPackages", () => {
  it("discovers direct-child packages and excludes private packages by default", () => {
    makeRepo();

    writeJson("packages/public/package.json", {
      name: "@moya/public",
      version: "1.2.3",
      scripts: { test: "vitest", build: "vite build" },
      publishConfig: { registry: "https://npm.pkg.github.com" },
    });
    writeJson("packages/private/package.json", {
      name: "@moya/private",
      private: true,
    });

    expect(discoverPackages(options())).toEqual([
      {
        directory: "packages/public",
        name: "@moya/public",
        version: "1.2.3",
        private: false,
        publishable: true,
        hasTest: true,
        hasBuild: true,
      },
    ]);
  });

  it("applies publish, test, and build filters", () => {
    makeRepo();

    writeJson("packages/complete/package.json", {
      name: "complete",
      publishConfig: { registry: "https://registry.npmjs.org" },
      scripts: { test: "vitest", build: "vite build" },
    });
    writeJson("packages/incomplete/package.json", {
      name: "incomplete",
      scripts: { test: "vitest" },
    });

    expect(
      discoverPackages(
        options({
          requirePublishConfig: true,
          requireTestScript: true,
          requireBuildScript: true,
        }),
      ).map((pkg) => pkg.name),
    ).toEqual(["complete"]);
  });

  it("includes the root package when requested and eligible", () => {
    makeRepo();

    writeJson("package.json", {
      name: "@moyarich/actions",
      version: "0.1.0",
      publishConfig: { registry: "https://npm.pkg.github.com" },
    });

    const packages = discoverPackages(
      options({ includeRootPackage: true, requirePublishConfig: true }),
    );

    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({
      directory: ".",
      name: "@moyarich/actions",
      version: "0.1.0",
      private: false,
      publishable: true,
    });
  });

  it("discovers tracked workspace packages from package.json patterns", () => {
    makeRepo();

    writeJson("package.json", {
      name: "workspace-root",
      private: true,
      workspaces: ["packages/*"],
    });
    writeJson("packages/alpha/package.json", {
      name: "@moya/alpha",
      version: "1.0.0",
    });
    writeJson("packages/beta/package.json", {
      name: "@moya/beta",
      version: "2.0.0",
    });

    execFileSync("git", [
      "add",
      "package.json",
      "packages/alpha/package.json",
      "packages/beta/package.json",
    ]);

    expect(
      discoverPackages(options({ useWorkspaces: true })).map((pkg) => pkg.name),
    ).toEqual(["@moya/alpha", "@moya/beta"]);
  });

  it("creates a GitHub Actions include matrix", () => {
    const packages = [
      {
        directory: ".",
        name: "@moya/root",
        version: "1.0.0",
        private: false,
      },
    ];

    expect(packageMatrix(packages)).toEqual({ include: packages });
  });
});

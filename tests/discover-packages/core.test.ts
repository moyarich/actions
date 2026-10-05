import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { discoverPackages } from "../../src/discover-packages/core";

function fixture() {
  const cwd = mkdtempSync(path.join(tmpdir(), "discover-packages-"));
  mkdirSync(path.join(cwd, "packages/a"), { recursive: true });
  mkdirSync(path.join(cwd, "packages/b"), { recursive: true });
  writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ name: "root", version: "1.0.0" }));
  writeFileSync(path.join(cwd, "packages/a/package.json"), JSON.stringify({
    name: "@test/a",
    version: "1.2.3",
    scripts: { test: "vitest" },
    publishConfig: { registry: "https://registry.npmjs.org" },
  }));
  writeFileSync(path.join(cwd, "packages/b/package.json"), JSON.stringify({
    name: "@test/b",
    private: true,
    scripts: { build: "vite build" },
  }));
  return cwd;
}

describe("discoverPackages", () => {
  it("discovers direct child packages", () => {
    const packages = discoverPackages({ cwd: fixture() });
    expect(packages.map((pkg) => pkg.name)).toEqual(["@test/a"]);
  });

  it("supports filters and root inclusion", () => {
    const packages = discoverPackages({
      cwd: fixture(),
      includeRootPackage: true,
      includePrivate: true,
      requireBuildScript: true,
    });
    expect(packages.map((pkg) => pkg.name)).toEqual(["@test/b"]);
  });

  it("requires publish config when requested", () => {
    const packages = discoverPackages({ cwd: fixture(), requirePublishConfig: true });
    expect(packages.map((pkg) => pkg.name)).toEqual(["@test/a"]);
  });
});

import { describe, expect, test } from "vitest";
import { releaseIdentity } from "../../src/release-identity/release-identity.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePackage(directory: string, name: string, version = "0.1.0") {
  return { directory, manifest: { name, version } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("releaseIdentity", () => {
  describe("nested packages", () => {
    test("creates directory-scoped tags and human-readable release names", () => {
      const pkg = makePackage(
        "packages/moyarich-auto-glow-md",
        "@moyarich/auto-glow-md",
      );

      expect(releaseIdentity(pkg, "0.1.0")).toEqual({
        packageName: "@moyarich/auto-glow-md",
        packageDirectory: "packages/moyarich-auto-glow-md",
        version: "0.1.0",
        tagName: "packages/moyarich-auto-glow-md@0.1.0",
        tagPrefix: "packages/moyarich-auto-glow-md@",
        releaseName: "@moyarich/auto-glow-md v0.1.0",
      });
    });

    test("normalizes a leading ./ and trailing / in the directory", () => {
      const pkg = makePackage(
        "./packages/workspace-tools/",
        "@moyarich/workspace-tools",
      );

      expect(releaseIdentity(pkg, "0.1.0")).toMatchObject({
        tagName: "packages/workspace-tools@0.1.0",
        tagPrefix: "packages/workspace-tools@",
      });
    });
  });

  describe("root package", () => {
    test("uses the package name as the tag scope", () => {
      const pkg = makePackage(".", "@moyarich/workspace-tools");

      expect(releaseIdentity(pkg, "0.1.0")).toEqual({
        packageName: "@moyarich/workspace-tools",
        packageDirectory: ".",
        version: "0.1.0",
        tagName: "@moyarich/workspace-tools@0.1.0",
        tagPrefix: "@moyarich/workspace-tools@",
        releaseName: "@moyarich/workspace-tools v0.1.0",
      });
    });
  });

  describe("version handling", () => {
    const pkg = makePackage(
      "./packages/workspace-tools/",
      "@moyarich/workspace-tools",
    );

    test("supports prerelease versions", () => {
      expect(releaseIdentity(pkg, "2.0.0-beta.1").tagName).toBe(
        "packages/workspace-tools@2.0.0-beta.1",
      );
    });

    test("passes release-drafter template tokens through unchanged", () => {
      expect(releaseIdentity(pkg, "$RESOLVED_VERSION").releaseName).toBe(
        "@moyarich/workspace-tools v$RESOLVED_VERSION",
      );
    });
  });
});

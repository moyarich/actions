import assert from "node:assert/strict";
import { test } from "vitest";
import {
  resolveNextVersion,
  resolveVersionSelection,
} from "../../src/sim-version-resolver/sim-version-resolver.ts";

test("preserves zero-major minor progression", () => {
  assert.equal(resolveNextVersion("0.1.0", "minor"), "0.2.0");
  assert.equal(resolveNextVersion("0.2.0", "minor"), "0.3.0");
  assert.equal(resolveNextVersion("0.3.0", "major"), "1.0.0");
});
test("resolves all modes and ignores inactive settings", () => {
  assert.equal(
    resolveVersionSelection("0.2.0", "package-json", "major", "9.0.0"),
    "0.2.0",
  );
  assert.equal(
    resolveVersionSelection("0.2.0", "exact", "major", "0.4.0"),
    "0.4.0",
  );
  assert.equal(
    resolveVersionSelection("0.2.0", "bump", "patch", "9.0.0"),
    "0.2.1",
  );
});
test("supports prerelease increments", () => {
  assert.equal(
    resolveNextVersion("0.2.0-beta.1", "prerelease"),
    "0.2.0-beta.2",
  );
  assert.equal(resolveNextVersion("0.2.0", "preminor"), "0.3.0-0");
});
test("rejects invalid versions and bump types", () => {
  assert.throws(
    () => resolveNextVersion("banana", "minor"),
    /Invalid current SemVer/,
  );
  assert.throws(
    () => resolveVersionSelection("0.1.0", "exact", "patch", ""),
    /Invalid exact SemVer/,
  );
  assert.throws(
    () => resolveNextVersion("0.1.0", "wrong"),
    /Invalid release bump/,
  );
});

test("ignores SemVer build metadata when calculating bumps", () => {
  assert.equal(resolveNextVersion("1.2.3+build.5", "patch"), "1.2.4");
  assert.equal(resolveNextVersion("1.2.3+sha.abc", "minor"), "1.3.0");
  assert.equal(resolveNextVersion("0.2.0-beta.1+ci.2", "prerelease"), "0.2.0-beta.2");
  assert.equal(resolveNextVersion("0.2.0+build.1", "prerelease"), "0.2.1-0");
  assert.equal(resolveVersionSelection("1.2.3+abc", "package-json"), "1.2.3+abc");
  assert.equal(resolveVersionSelection("1.2.3", "exact", "patch", "2.0.0+build.1"), "2.0.0+build.1");
});

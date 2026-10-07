import { describe, expect, test } from "vitest";
import {
  restoreCandidatePackArgs,
  summarizeRestoreArtifactEquivalence,
  type RestoreEquivalenceAttempt,
} from "../../src/release-identity/restore-equivalence.ts";

const npm = "https://registry.npmjs.org";
const github = "https://npm.pkg.github.com";

function attempt(
  registry: string,
  equivalent: boolean,
  error?: string,
): RestoreEquivalenceAttempt {
  return {
    registry,
    equivalent,
    ...(error ? { error } : {}),
  };
}

describe("summarizeRestoreArtifactEquivalence", () => {
  test("accepts when the candidate matches the only published copy", () => {
    expect(
      summarizeRestoreArtifactEquivalence([attempt(github, true)]),
    ).toEqual({
      equivalent: true,
      matchedRegistry: github,
      attempts: [attempt(github, true)],
    });
  });

  test("accepts when any published copy matches", () => {
    const attempts = [attempt(npm, false), attempt(github, true)];

    expect(summarizeRestoreArtifactEquivalence(attempts)).toEqual({
      equivalent: true,
      matchedRegistry: github,
      attempts,
    });
  });

  test("accepts a verified match even if another published copy cannot be verified", () => {
    const attempts = [
      attempt(npm, false, "registry unavailable"),
      attempt(github, true),
    ];

    expect(summarizeRestoreArtifactEquivalence(attempts)).toEqual({
      equivalent: true,
      matchedRegistry: github,
      attempts,
    });
  });

  test("rejects when no published copy matches", () => {
    const attempts = [attempt(npm, false), attempt(github, false)];

    expect(summarizeRestoreArtifactEquivalence(attempts)).toEqual({
      equivalent: false,
      matchedRegistry: null,
      attempts,
    });
  });

  test("rejects when every published copy is unverifiable", () => {
    const attempts = [
      attempt(npm, false, "registry unavailable"),
      attempt(github, false, "authentication failed"),
    ];

    expect(summarizeRestoreArtifactEquivalence(attempts)).toEqual({
      equivalent: false,
      matchedRegistry: null,
      attempts,
    });
  });
});


describe("restoreCandidatePackArgs", () => {
  test("packs the root package as committed without running lifecycle scripts", () => {
    expect(restoreCandidatePackArgs(".", "@moyarich/workspace-tools", "/tmp/out")).toEqual([
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      "/tmp/out",
    ]);
  });

  test("packs workspace packages as committed without running lifecycle scripts", () => {
    expect(
      restoreCandidatePackArgs(
        "packages/example",
        "@moyarich/example",
        "/tmp/out",
      ),
    ).toEqual([
      "pack",
      "--workspace",
      "@moyarich/example",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      "/tmp/out",
    ]);
  });
});

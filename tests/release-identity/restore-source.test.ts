import { describe, expect, test } from "vitest";
import { resolveRestoreSource } from "../../src/release-identity/restore-source.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const repository = "moyarich/workspace-tools";
const fullSha = "8b4539e214afc9d87dfbad3e52243e4426c26179";
const shortSha = "8b4539e";
const tagName = "@moyarich/workspace-tools@0.1.1";
const runId = "37624987179";
const artifactId = "11484185701";

const repoUrl = `https://github.com/${repository}`;

// ---------------------------------------------------------------------------
// Fake command runner
//
// Maps the identifying argument of each supported git/gh call to its result.
// Anything not listed here throws, so tests fail loudly on unexpected calls.
// ---------------------------------------------------------------------------

const gitRevParseResults: Record<string, string> = {
  [`${shortSha}^{commit}`]: fullSha,
  [`${fullSha}^{commit}`]: fullSha,
  [`refs/tags/${tagName}^{commit}`]: fullSha,
};

const ghApiResults: Record<string, string> = {
  [`repos/${repository}/actions/runs/${runId}`]: fullSha,
  [`repos/${repository}/actions/artifacts/${artifactId}`]: fullSha,
};

function fakeCommand(command: string, args: string[]): string {
  const result =
    command === "git" && args[0] === "rev-parse"
      ? gitRevParseResults[args.at(-1) ?? ""]
      : command === "gh" && args[0] === "api"
        ? ghApiResults[args[1] ?? ""]
        : undefined;

  if (result === undefined) {
    throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
  }

  return result;
}

function resolve(source: string, repo = repository) {
  return resolveRestoreSource(source, repo, { command: fakeCommand });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveRestoreSource", () => {
  describe("typed sources", () => {
    test.each([
      {
        kind: "commit",
        value: shortSha,
        note: "normalizes a short SHA to a full SHA",
      },
      { kind: "tag", value: tagName, note: "resolves a tag to its commit" },
      {
        kind: "run",
        value: runId,
        note: "resolves a workflow run to its commit",
      },
      {
        kind: "artifact",
        value: artifactId,
        note: "resolves a workflow artifact to its commit",
      },
    ])("$kind: $note", ({ kind, value }) => {
      const source = `${kind}:${value}`;

      expect(resolve(source)).toEqual({
        source,
        kind,
        resolvedKind: kind,
        value,
        commit: fullSha,
      });
    });
  });

  describe("github-url sources", () => {
    test.each([
      {
        name: "commit URL",
        url: `${repoUrl}/commit/${shortSha}`,
        resolvedKind: "commit",
        value: shortSha,
      },
      {
        name: "release tag URL (percent-encoded)",
        url: `${repoUrl}/releases/tag/%40moyarich%2Fworkspace-tools%400.1.1`,
        resolvedKind: "tag",
        value: tagName,
      },
      {
        name: "workflow run URL",
        url: `${repoUrl}/actions/runs/${runId}`,
        resolvedKind: "run",
        value: runId,
      },
      {
        name: "workflow artifact URL",
        url: `${repoUrl}/actions/runs/${runId}/artifacts/${artifactId}`,
        resolvedKind: "artifact",
        value: artifactId,
      },
    ])(
      "classifies a $name and delegates to the matching resolver",
      (testCase) => {
        const source = `github-url:${testCase.url}`;

        expect(resolve(source)).toEqual({
          source,
          kind: "github-url",
          resolvedKind: testCase.resolvedKind,
          value: testCase.value,
          commit: fullSha,
        });
      },
    );
  });

  describe("invalid sources", () => {
    test("rejects untyped sources", () => {
      expect(() => resolve(shortSha)).toThrow(/restore-source must use/);
    });

    test("rejects unsupported source kinds", () => {
      expect(() => resolve("release:v1.0.0")).toThrow(
        /Unsupported restore-source kind/,
      );
    });

    test.each([
      { source: "run:not-a-run", error: /numeric workflow run ID/ },
      {
        source: "artifact:not-an-artifact",
        error: /numeric workflow artifact ID/,
      },
    ])(
      "validates identifier before GitHub lookup: $source",
      ({ source, error }) => {
        expect(() => resolve(source)).toThrow(error);
      },
    );

    test("rejects github-url sources from another repository", () => {
      expect(() =>
        resolve("github-url:https://github.com/example/other/commit/8b4539e"),
      ).toThrow(/must belong to the current repository/);
    });
  });
});

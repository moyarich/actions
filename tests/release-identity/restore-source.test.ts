import assert from "node:assert/strict";
import { test } from "vitest";
import { resolveRestoreSource } from "../../src/release-identity/restore-source.ts";

const repository = "moyarich/workspace-tools";
const fullSha = "8b4539e214afc9d87dfbad3e52243e4426c26179";

function fakeCommand(command: string, args: string[]): string {
  if (command === "git" && args[0] === "rev-parse") {
    const value = args.at(-1) ?? "";
    if (
      value === "8b4539e^{commit}" ||
      value === `${fullSha}^{commit}` ||
      value === "refs/tags/@moyarich/workspace-tools@0.1.1^{commit}"
    ) {
      return fullSha;
    }
  }

  if (command === "gh" && args[0] === "api") {
    if (args[1] === `repos/${repository}/actions/runs/37624987179`) {
      return fullSha;
    }

    if (args[1] === `repos/${repository}/actions/artifacts/11484185701`) {
      return fullSha;
    }
  }

  throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
}

test("resolveRestoreSource dispatches commit sources and normalizes to a full SHA", () => {
  assert.deepEqual(
    resolveRestoreSource("commit:8b4539e", repository, {
      command: fakeCommand,
    }),
    {
      source: "commit:8b4539e",
      kind: "commit",
      resolvedKind: "commit",
      value: "8b4539e",
      commit: fullSha,
    },
  );
});

test("resolveRestoreSource dispatches tag sources", () => {
  const source = "tag:@moyarich/workspace-tools@0.1.1";

  assert.deepEqual(resolveRestoreSource(source, repository, { command: fakeCommand }), {
    source,
    kind: "tag",
    resolvedKind: "tag",
    value: "@moyarich/workspace-tools@0.1.1",
    commit: fullSha,
  });
});

test("resolveRestoreSource dispatches workflow run sources", () => {
  const source = "run:37624987179";

  assert.deepEqual(resolveRestoreSource(source, repository, { command: fakeCommand }), {
    source,
    kind: "run",
    resolvedKind: "run",
    value: "37624987179",
    commit: fullSha,
  });
});

test("resolveRestoreSource dispatches workflow artifact sources", () => {
  const source = "artifact:11484185701";

  assert.deepEqual(resolveRestoreSource(source, repository, { command: fakeCommand }), {
    source,
    kind: "artifact",
    resolvedKind: "artifact",
    value: "11484185701",
    commit: fullSha,
  });
});

test("resolveRestoreSource classifies supported GitHub URLs and delegates through dispatch", () => {
  const sources = [
    {
      source: `github-url:https://github.com/${repository}/commit/8b4539e`,
      resolvedKind: "commit",
      value: "8b4539e",
    },
    {
      source:
        `github-url:https://github.com/${repository}/releases/tag/%40moyarich%2Fworkspace-tools%400.1.1`,
      resolvedKind: "tag",
      value: "@moyarich/workspace-tools@0.1.1",
    },
    {
      source:
        `github-url:https://github.com/${repository}/actions/runs/37624987179`,
      resolvedKind: "run",
      value: "37624987179",
    },
    {
      source:
        `github-url:https://github.com/${repository}/actions/runs/37624987179/artifacts/11484185701`,
      resolvedKind: "artifact",
      value: "11484185701",
    },
  ] as const;

  for (const expected of sources) {
    const result = resolveRestoreSource(expected.source, repository, {
      command: fakeCommand,
    });

    assert.equal(result.kind, "github-url");
    assert.equal(result.resolvedKind, expected.resolvedKind);
    assert.equal(result.value, expected.value);
    assert.equal(result.commit, fullSha);
  }
});

test("resolveRestoreSource rejects untyped sources", () => {
  assert.throws(
    () => resolveRestoreSource("8b4539e", repository, { command: fakeCommand }),
    /restore-source must use/,
  );
});

test("resolveRestoreSource rejects unsupported source kinds", () => {
  assert.throws(
    () =>
      resolveRestoreSource("release:v1.0.0", repository, {
        command: fakeCommand,
      }),
    /Unsupported restore-source kind/,
  );
});

test("resolveRestoreSource validates run and artifact identifiers before GitHub lookup", () => {
  assert.throws(
    () =>
      resolveRestoreSource("run:not-a-run", repository, {
        command: fakeCommand,
      }),
    /numeric workflow run ID/,
  );

  assert.throws(
    () =>
      resolveRestoreSource("artifact:not-an-artifact", repository, {
        command: fakeCommand,
      }),
    /numeric workflow artifact ID/,
  );
});

test("resolveRestoreSource rejects github-url sources from another repository", () => {
  assert.throws(
    () =>
      resolveRestoreSource(
        "github-url:https://github.com/example/other/commit/8b4539e",
        repository,
        { command: fakeCommand },
      ),
    /must belong to the current repository/,
  );
});

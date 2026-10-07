import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "vitest";
import { resolveRestoreSource } from "../../src/release-identity/restore-source.ts";

const repository = "moyarich/workspace-tools";

test("resolveRestoreSource resolves commit sources to a full SHA", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();

  const resolution = resolveRestoreSource(
    `commit:${head.slice(0, 8)}`,
    repository,
  );

  assert.equal(resolution.kind, "commit");
  assert.equal(resolution.resolvedKind, "commit");
  assert.equal(resolution.commit, head);
});

test("resolveRestoreSource resolves current-repository commit URLs through github-url", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();

  const resolution = resolveRestoreSource(
    `github-url:https://github.com/${repository}/commit/${head}`,
    repository,
  );

  assert.equal(resolution.kind, "github-url");
  assert.equal(resolution.resolvedKind, "commit");
  assert.equal(resolution.value, head);
  assert.equal(resolution.commit, head);
});

test("resolveRestoreSource rejects untyped sources", () => {
  assert.throws(
    () => resolveRestoreSource("HEAD", repository),
    /restore-source must use/,
  );
});

test("resolveRestoreSource rejects unsupported source kinds", () => {
  assert.throws(
    () => resolveRestoreSource("release:v1.0.0", repository),
    /Unsupported restore-source kind/,
  );
});

test("resolveRestoreSource rejects github-url sources from another repository", () => {
  assert.throws(
    () =>
      resolveRestoreSource(
        "github-url:https://github.com/example/other/commit/abc123",
        repository,
      ),
    /must belong to the current repository/,
  );
});

import assert from "node:assert/strict";
import { test } from "vitest";
import {
  changelogSection,
  existingChangelogSection,
  npmVersionArgs,
  parseReleaseArgument,
  releaseNotes,
  resolveNextVersion,
  resolveVersionSelection,
} from "../../src/release/release.ts";
import { packageInfo } from "../../src/workspace/workspace.ts";

test("parseReleaseArgument accepts bump names", () => {
  assert.deepEqual(parseReleaseArgument("demo-tools=patch"), {
    selector: "demo-tools",
    versionSpec: "patch",
  });
});

test("parseReleaseArgument accepts a bare selector for package-json mode", () => {
  assert.deepEqual(
    parseReleaseArgument("demo-tools", { mode: "package-json" }),
    {
      selector: "demo-tools",
      versionSpec: null,
    },
  );
});

test("parseReleaseArgument accepts explicit semver", () => {
  assert.deepEqual(parseReleaseArgument("demo-tools=1.2.3-beta.1"), {
    selector: "demo-tools",
    versionSpec: "1.2.3-beta.1",
  });
});

test("parseReleaseArgument rejects malformed input and versions", () => {
  assert.throws(() => parseReleaseArgument("demo-tools"), /Usage:/);
  assert.throws(
    () => parseReleaseArgument("demo-tools=banana"),
    /Invalid version/,
  );
});

test("packageInfo rejects selectors that can escape configured workspaces", () => {
  assert.throws(
    () => packageInfo(process.cwd(), "../demo-tools"),
    /Package selector/,
  );
  assert.throws(
    () => packageInfo(process.cwd(), "packages/../demo-tools"),
    /Package selector/,
  );
});

test("releaseNotes groups package changes for consumers", () => {
  assert.deepEqual(
    releaseNotes([
      "feat(parser): support relative colors",
      "fix: preserve alpha values",
      "refactor: simplify tokenizer",
      "release: parser@1.2.2",
    ]),
    {
      Added: ["support relative colors"],
      Changed: ["simplify tokenizer"],
      Fixed: ["preserve alpha values"],
      Removed: [],
    },
  );
});

test("changelogSection renders release-note categories", () => {
  assert.equal(
    changelogSection("1.2.3", {
      Added: ["support relative colors"],
      Changed: [],
      Fixed: ["preserve alpha values"],
      Removed: [],
    }),
    "## 1.2.3\n\n### Added\n\n- support relative colors\n\n### Fixed\n\n- preserve alpha values\n",
  );
});

test("resolveNextVersion computes release versions without touching package files", () => {
  assert.equal(resolveNextVersion("0.1.1", "patch"), "0.1.2");
  assert.equal(resolveNextVersion("0.1.1", "minor"), "0.2.0");
  assert.equal(resolveNextVersion("0.1.1", "major"), "1.0.0");
  assert.equal(resolveNextVersion("1.2.3", "prepatch"), "1.2.4-0");
  assert.equal(
    resolveNextVersion("1.2.3-beta.1", "prerelease"),
    "1.2.3-beta.2",
  );
  assert.equal(resolveNextVersion("1.2.3-beta", "prerelease"), "1.2.3-beta.0");
  assert.equal(resolveNextVersion("1.2.3", "1.2.4"), "1.2.4");
});

test("npmVersionArgs versions the repository root without treating it as a workspace", () => {
  assert.deepEqual(
    npmVersionArgs(
      {
        directory: ".",
        manifest: { name: "@moyarich/workspace-tools" },
      },
      "patch",
    ),
    ["version", "patch", "--git-tag-version=false"],
  );
});

test("npmVersionArgs keeps --workspace for nested workspace packages", () => {
  assert.deepEqual(
    npmVersionArgs(
      {
        directory: "packages/demo-tools",
        manifest: { name: "@moyarich/demo-tools" },
      },
      "minor",
    ),
    [
      "version",
      "minor",
      "--workspace",
      "@moyarich/demo-tools",
      "--git-tag-version=false",
    ],
  );
});

test("existingChangelogSection preserves curated bracketed release notes", () => {
  const changelog = [
    "# Changelog",
    "",
    "## [0.1.1]",
    "",
    "### Publishing",
    "",
    "- Keep this curated text.",
    "",
    "## [0.1.0] - Initial Release",
    "",
    "- Earlier release.",
    "",
  ].join("\n");

  assert.equal(
    existingChangelogSection(changelog, "0.1.1"),
    "## [0.1.1]\n\n### Publishing\n\n- Keep this curated text.\n",
  );
});

test("existingChangelogSection supports unbracketed version headings", () => {
  assert.equal(
    existingChangelogSection(
      "# Changelog\n\n## 1.2.3\n\n### Fixed\n\n- A fix.\n",
      "1.2.3",
    ),
    "## 1.2.3\n\n### Fixed\n\n- A fix.\n",
  );
});

test("existingChangelogSection returns null when the version is absent", () => {
  assert.equal(
    existingChangelogSection("# Changelog\n\n## [1.2.2]\n", "1.2.3"),
    null,
  );
});

test("release version selection preserves v0 minor progression", () => {
  assert.equal(resolveVersionSelection("0.1.0", "bump", "minor"), "0.2.0");
  assert.equal(resolveVersionSelection("0.2.0", "bump", "minor"), "0.3.0");
  assert.equal(resolveVersionSelection("0.3.0", "bump", "major"), "1.0.0");
});

test("inactive version inputs do not override the selected release mode", () => {
  assert.equal(resolveVersionSelection("0.2.0", "package-json", "major", "9.0.0"), "0.2.0");
  assert.equal(resolveVersionSelection("0.2.0", "exact", "major", "0.4.0"), "0.4.0");
  assert.equal(resolveVersionSelection("0.2.0", "bump", "patch", "9.0.0"), "0.2.1");
  assert.throws(() => resolveVersionSelection("0.2.0", "exact", "minor", ""), /Invalid exact SemVer/);
});

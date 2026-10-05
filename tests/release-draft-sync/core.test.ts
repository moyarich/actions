import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  GENERATED_END,
  GENERATED_START,
  reconcileReleaseBody,
} from "../../src/release-draft-sync/core";

const tempDirectories: string[] = [];

function tempDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "release-draft-sync-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("reconcileReleaseBody", () => {
  it("seeds a missing draft from Release Drafter output", () => {
    const result = reconcileReleaseBody({
      existingBody: "",
      generatedBody:
        "### Features\n\n- New feature (#12) @dev <!-- moya-release:pr=12 -->",
      changelogPath: "/missing/CHANGELOG.md",
      version: "0.1.0",
      targetKey: "root",
      seedSha: "abc123",
      targetPath: "",
    });

    expect(result).toContain("<!-- moya-release:target=root -->");
    expect(result).toContain(
      "<!-- moya-release:seed-sha=abc123 source=release-drafter -->",
    );
    expect(result).toContain("<!-- moya-release:pr=12 -->");
  });

  it("prefers a matching changelog version when seeding a missing draft", () => {
    const directory = tempDirectory();
    const changelogPath = path.join(directory, "CHANGELOG.md");

    writeFileSync(
      changelogPath,
      [
        "# Changelog",
        "",
        "## 0.1.0",
        "",
        "Initial public capability.",
        "",
        "## 0.0.1",
        "",
        "Older notes.",
      ].join("\n"),
    );

    const result = reconcileReleaseBody({
      existingBody: "",
      generatedBody:
        "### Features\n\n- New feature (#12) @dev <!-- moya-release:pr=12 -->",
      changelogPath,
      version: "0.1.0",
      targetKey: "root",
      seedSha: "abc123",
      targetPath: "",
    });

    expect(result).toContain("Initial public capability.");
    expect(result).not.toContain("Older notes.");
    expect(result).not.toContain("moya-release:pr=12");
    expect(result).toContain("source=changelog");
  });

  it("preserves manual text and appends only unseen PR entries", () => {
    const existing = [
      "<!-- moya-release:target=root -->",
      "<!-- moya-release:seed-sha=abc123 source=release-drafter -->",
      "",
      "Reviewer introduction.",
      "",
      GENERATED_START,
      "",
      "### Features",
      "",
      "- Existing (#12) @dev <!-- moya-release:pr=12 -->",
      "",
      GENERATED_END,
      "",
      "Manual footer.",
    ].join("\n");

    const generated = [
      "### Features",
      "",
      "- Existing (#12) @dev <!-- moya-release:pr=12 -->",
      "- Added later (#13) @dev <!-- moya-release:pr=13 -->",
    ].join("\n");

    const result = reconcileReleaseBody({
      existingBody: existing,
      generatedBody: generated,
      changelogPath: "",
      version: "0.1.0",
      targetKey: "root",
      seedSha: "abc123",
      targetPath: "",
    });

    expect(result).toContain("Reviewer introduction.");
    expect(result).toContain("Manual footer.");
    expect(result.match(/moya-release:pr=12/g)).toHaveLength(1);
    expect(result.match(/moya-release:pr=13/g)).toHaveLength(1);
  });

  it("is idempotent when the same generated PRs are reconciled again", () => {
    const generated =
      "### Bug fixes\n\n- Fix issue (#21) @dev <!-- moya-release:pr=21 -->";

    const first = reconcileReleaseBody({
      existingBody: "Maintainer notes.",
      generatedBody: generated,
      changelogPath: "",
      version: "0.1.0",
      targetKey: "root",
      seedSha: "abc123",
      targetPath: "",
    });

    const second = reconcileReleaseBody({
      existingBody: first,
      generatedBody: generated,
      changelogPath: "",
      version: "0.1.0",
      targetKey: "root",
      seedSha: "abc123",
      targetPath: "",
    });

    expect(second).toBe(first);
    expect(second.match(/moya-release:pr=21/g)).toHaveLength(1);
  });

  it("appends a newly discovered category without rewriting existing generated text", () => {
    const existing = [
      "<!-- moya-release:target=root -->",
      GENERATED_START,
      "### Features",
      "",
      "- Feature (#1) @dev <!-- moya-release:pr=1 -->",
      GENERATED_END,
    ].join("\n\n");

    const result = reconcileReleaseBody({
      existingBody: existing,
      generatedBody:
        "### Bug fixes\n\n- Fix (#2) @dev <!-- moya-release:pr=2 -->",
      changelogPath: "",
      version: "0.1.0",
      targetKey: "root",
      seedSha: "abc123",
      targetPath: "",
    });

    expect(result).toContain("### Features");
    expect(result).toContain("moya-release:pr=1");
    expect(result).toContain("### Bug fixes");
    expect(result).toContain("moya-release:pr=2");
  });
});

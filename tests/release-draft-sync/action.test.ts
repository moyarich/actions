import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAction } from "../../src/actions/release-draft-sync";

const originalEnv = { ...process.env };
const tempDirectories: string[] = [];

function tempDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "release-draft-action-"));
  tempDirectories.push(directory);
  return directory;
}

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };

  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("runAction", () => {
  it("reads action inputs, writes the reconciled body, and emits outputs", () => {
    const directory = tempDirectory();
    const existingFile = path.join(directory, "existing.md");
    const generatedFile = path.join(directory, "generated.md");
    const outputFile = path.join(directory, "result.md");
    const githubOutput = path.join(directory, "github-output.txt");

    writeFileSync(existingFile, "Maintainer introduction.\n");
    writeFileSync(
      generatedFile,
      "### Features\n\n- New action (#25) @dev <!-- release-draft-sync:pr=25 -->\n",
    );

    process.env.INPUT_EXISTING_BODY_FILE = existingFile;
    process.env.INPUT_GENERATED_BODY_FILE = generatedFile;
    process.env.INPUT_OUTPUT_FILE = outputFile;
    process.env.INPUT_CHANGELOG_PATH = "";
    process.env.INPUT_VERSION = "0.1.0";
    process.env.INPUT_TARGET_KEY = "root";
    process.env.INPUT_SEED_SHA = "abc123";
    process.env.INPUT_TARGET_PATH = "";
    process.env.GITHUB_OUTPUT = githubOutput;

    runAction();

    const body = readFileSync(outputFile, "utf8");
    const outputs = readFileSync(githubOutput, "utf8");

    expect(body).toContain("Maintainer introduction.");
    expect(body).toContain("release-draft-sync:pr=25");
    expect(body).toContain("release-draft-sync:seed-sha=abc123");
    expect(outputs).toContain(`body-file=${outputFile}`);
    expect(outputs).toContain("seed-sha=abc123");
  });

  it("rejects missing required file inputs", () => {
    process.env.INPUT_EXISTING_BODY_FILE = "";
    process.env.INPUT_GENERATED_BODY_FILE = "";
    process.env.INPUT_OUTPUT_FILE = "";

    expect(() => runAction()).toThrow(
      "Missing required input: existing-body-file",
    );
  });
});

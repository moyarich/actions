import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAction } from "../../src/discover-packages/action";

const originalEnv = { ...process.env };
const originalCwd = process.cwd();
const tempDirectories: string[] = [];

beforeEach(() => {
  process.env = { ...originalEnv };
  process.chdir(originalCwd);
});

afterEach(() => {
  process.env = { ...originalEnv };
  process.chdir(originalCwd);

  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("runAction", () => {
  it("writes packages, matrix, count, and has-packages outputs", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "discover-action-"));
    tempDirectories.push(directory);
    process.chdir(directory);

    writeFileSync(
      "package.json",
      JSON.stringify({
        name: "@moyarich/actions",
        publishConfig: { registry: "https://npm.pkg.github.com" },
      }),
    );

    const output = path.join(directory, "github-output.txt");
    process.env.GITHUB_OUTPUT = output;
    process.env.INPUT_INCLUDE_ROOT_PACKAGE = "true";
    process.env.INPUT_REQUIRE_PUBLISH_CONFIG = "true";

    runAction();

    const contents = readFileSync(output, "utf8");
    expect(contents).toContain("count=1");
    expect(contents).toContain("has-packages=true");
    expect(contents).toContain('"name":"@moyarich/actions"');
    expect(contents).toContain('matrix={"include":');
  });
});

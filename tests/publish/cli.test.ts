import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");

function invoke(script: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: "pipe",
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

for (const command of [
  "dist/bin/workspace-release.mjs",
  "dist/bin/workspace-publish.mjs",
  "dist/bin/discover-packages.mjs",
]) {
  describe(command, () => {
    test("shows help without running its action", () => {
      const result = invoke(command, "--help");
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/Usage:/);
      expect(result.stdout).toMatch(/--help/);
    });

    test("rejects unknown flags before running its action", () => {
      const result = invoke(command, "--not-a-real-option");
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/unknown option/);
    });
  });
}

test("package discovery preserves its default directory and JSON output", () => {
  const result = invoke(
    "dist/bin/discover-packages.mjs",
    "--workspaces",
    "--include-root-package",
    "--include-private",
    "--json",
  );
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "@moyarich/workspace-tools",
        directory: ".",
      }),
    ]),
  );
});

test("release accepts both separated and equals option values", () => {
  for (const args of [
    ["--mode=exact", "--version=invalid"],
    ["--mode", "exact", "--version", "invalid"],
  ]) {
    const result = invoke(
      "dist/bin/workspace-release.mjs",
      "--package=.",
      "--dry-run",
      ...args,
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Invalid exact SemVer: invalid/);
  }
});

test("publish rejects values assigned to boolean flags", () => {
  const result = invoke("dist/bin/workspace-publish.mjs", "--dry-run=invalid");
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/unknown option '--dry-run=invalid'/);
});

test("publish CLI accepts all as a registry selection", () => {
  const result = invoke(
    "dist/bin/workspace-publish.mjs",
    "--registry=all",
    "--help",
  );

  expect(result.status).toBe(0);
  expect(result.stdout).toMatch(/--registry <registry>/);
  expect(result.stderr).not.toMatch(/allowed choices|invalid argument/i);
});

test("named package selectors replace positional release arguments", () => {
  const result = invoke(
    "dist/bin/workspace-release.mjs",
    ".",
    "--mode=package-json",
    "--dry-run",
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(
    /too many arguments|excess arguments|unexpected argument/i,
  );
});

test("release refuses to prompt for missing named options in non-TTY mode", () => {
  const result = invoke(
    "dist/bin/workspace-release.mjs",
    "--no-interactive",
    "--dry-run",
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/Missing --package/);
});

#!/usr/bin/env node
import { program } from "commander";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
function repositoryRoot() {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}
const DEFAULT_CI_LOCKFILE_PACKAGES = ["@rollup/rollup-linux-x64-gnu"];
function assertLockfilePackages(lock, requiredPackages = DEFAULT_CI_LOCKFILE_PACKAGES) {
  const packages = lock?.packages ?? {};
  const missing = requiredPackages.filter(
    (name) => !packages[`node_modules/${name}`]
  );
  if (missing.length) {
    throw new Error(
      `package-lock.json is missing CI platform dependencies:
${missing.map((name) => `- ${name}`).join("\n")}
Regenerate the lockfile so it contains optional dependencies for supported CI platforms.`
    );
  }
  return requiredPackages;
}
function git(root, args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "inherit"]
  }).trim();
}
function assertSafeBranch(branch) {
  if (!branch || /^refs\//.test(branch) || /^pull\//.test(branch) || /\.\.|[~^:\\\s]/.test(branch)) {
    throw new Error(`Unsafe branch ref: ${branch || "<empty>"}`);
  }
}
function updateWorkspacePackageLock(options = {}) {
  const root = repositoryRoot();
  const lockfile = resolve(root, "package-lock.json");
  const manifest = resolve(root, "package.json");
  const dryRun = Boolean(options.dryRun);
  const commit = Boolean(options.commit);
  if (dryRun && commit)
    throw new Error("--dry-run and --commit cannot be used together.");
  if (!existsSync(manifest))
    throw new Error("Root package.json was not found.");
  if (!existsSync(lockfile))
    throw new Error("Root package-lock.json was not found.");
  const beforeStatus = git(
    root,
    ["status", "--porcelain=v1", "--untracked-files=all"],
    { quiet: true }
  );
  if (beforeStatus)
    throw new Error(
      "Working tree must be clean before updating package-lock.json."
    );
  const before = readFileSync(lockfile);
  const head = git(root, ["rev-parse", "HEAD"], { quiet: true });
  if (commit) {
    const branch = options.branch || git(root, ["branch", "--show-current"], { quiet: true });
    assertSafeBranch(branch);
  }
  try {
    execFileSync(
      "npm",
      [
        "install",
        "--package-lock-only",
        "--include=optional",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund"
      ],
      {
        cwd: root,
        stdio: options.json ? ["ignore", "ignore", "inherit"] : "inherit"
      }
    );
    const changedFiles = git(
      root,
      ["status", "--porcelain=v1", "--untracked-files=all"],
      { quiet: true }
    ).split("\n").filter(Boolean).map((line) => line.slice(3).split(" -> ").at(-1));
    const unexpected = changedFiles.filter(
      (file) => file !== "package-lock.json"
    );
    if (unexpected.length) {
      throw new Error(
        `Updating package-lock.json modified unexpected files:
${unexpected.map((file) => `- ${file}`).join("\n")}`
      );
    }
    const changed = changedFiles.includes("package-lock.json");
    const parsed = JSON.parse(readFileSync(lockfile, "utf8"));
    const validatedPackages = assertLockfilePackages(
      parsed,
      options.requiredPackages
    );
    let committed = false;
    let branch = null;
    if (commit && changed) {
      branch = options.branch || git(root, ["branch", "--show-current"], { quiet: true });
      assertSafeBranch(branch);
      git(root, ["add", "--", "package-lock.json"]);
      const staged = git(root, ["diff", "--cached", "--name-only"], {
        quiet: true
      });
      if (staged !== "package-lock.json")
        throw new Error("Refusing to commit unexpected staged files.");
      execFileSync("git", ["config", "user.name", "github-actions[bot]"], {
        cwd: root
      });
      execFileSync(
        "git",
        [
          "config",
          "user.email",
          "41898282+github-actions[bot]@users.noreply.github.com"
        ],
        { cwd: root }
      );
      execFileSync(
        "git",
        ["commit", "-m", "chore(workspaces): recreate package-lock.json"],
        { cwd: root, stdio: "inherit" }
      );
      execFileSync(
        "git",
        ["push", "--", "origin", `HEAD:refs/heads/${branch}`],
        { cwd: root, stdio: "inherit" }
      );
      committed = true;
    }
    const result = {
      operation: "package-lock",
      status: committed ? "committed" : changed ? "changed" : "current",
      dryRun,
      changed,
      committed,
      branch,
      lockfileVersion: parsed.lockfileVersion ?? "unknown",
      validatedPackages
    };
    if (dryRun) {
      writeFileSync(lockfile, before);
      if (git(root, ["rev-parse", "HEAD"], { quiet: true }) !== head) {
        throw new Error("Dry-run changed repository history.");
      }
    }
    return result;
  } catch (error) {
    if (dryRun && existsSync(lockfile)) writeFileSync(lockfile, before);
    throw error;
  }
}
function runPackageLock(options = {}) {
  const result = updateWorkspacePackageLock(options);
  if (options.json)
    process.stdout.write(`${JSON.stringify(result, null, 2)}
`);
  else {
    const action = result.committed ? "committed" : result.changed ? "would change" : "is current";
    console.log(
      `package-lock.json ${action} (lockfileVersion ${result.lockfileVersion}).`
    );
  }
  return result;
}
program.name("workspace-package-lock").description(
  "Review, recreate, or commit the root workspace package-lock.json."
).option(
  "-d, --dry-run",
  "Preview lockfile changes and restore the original file"
).option("-j, --json", "Print the operation result as JSON").option("-c, --commit", "Commit and push package-lock.json when it changes").option("--branch <branch>", "Explicit branch to push when --commit is used").action((options) => {
  runPackageLock(options);
});
await program.parseAsync();

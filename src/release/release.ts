import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import {
  execFileSync,
  spawnSync,
  type ExecFileSyncOptions,
} from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { releaseIdentity } from "../release-identity/release-identity.ts";
import { packageInfo, repositoryRoot } from "../workspace/workspace.ts";

import {
  assertDependencies,
  dependencyCheck,
  printDependencyCheck,
} from "../dependency-check/dependency-check.ts";

/**
 * Supported semantic-version bump types.
 *
 * @type {ReadonlySet<string>}
 */
const VALID_BUMPS = new Set([
  "major",
  "minor",
  "patch",
  "premajor",
  "preminor",
  "prepatch",
  "prerelease",
]);

/**
 * Supported release modes.
 *
 * @type {ReadonlySet<string>}
 */
const RELEASE_MODES = new Set(["bump", "exact", "package-version"]);

/**
 * Semantic Versioning pattern.
 */
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * Whether ANSI styling should be enabled.
 */
const COLOR = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

/**
 * Apply an ANSI style when terminal coloring is enabled.
 *
 * @param {string} code
 * ANSI escape code.
 *
 * @param {string} value
 * Value to style.
 *
 * @returns {string}
 * Styled or unchanged value.
 */
function ansi(code: string, value: string): string {
  return COLOR ? `\x1b[${code}m${value}\x1b[0m` : value;
}

/**
 * Terminal styling helpers.
 */
const style = {
  bold: (value: string) => ansi("1", value),
  cyan: (value: string) => ansi("36", value),
  green: (value: string) => ansi("32", value),
  yellow: (value: string) => ansi("33", value),
  red: (value: string) => ansi("31", value),
  dim: (value: string) => ansi("2", value),
};

/**
 * @typedef {"bump" | "exact" | "package-version"} ReleaseMode
 */

/**
 * @typedef {object} ReleaseOptions
 *
 * @property {ReleaseMode} [mode]
 * Release mode.
 *
 * @property {string} [version]
 * Explicit bump or version override.
 *
 * @property {boolean} [dryRun]
 * Preview the release without making changes.
 *
 * @property {boolean} [json]
 * Return machine-readable release information.
 *
 * @property {boolean} [fzf]
 * Allow interactive fzf selection.
 */

interface ReleaseOptions {
  mode?: "bump" | "exact" | "package-version";
  version?: string;
  dryRun?: boolean;
  json?: boolean;
  fzf?: boolean;
}

/**
 * Calculate the next package version.
 *
 * @param {string} currentVersion
 * Current semantic version.
 *
 * @param {string} versionSpec
 * Exact version or semantic-version bump.
 *
 * @returns {string}
 * Resolved next version.
 */
export function resolveNextVersion(
  currentVersion: string,
  versionSpec: string,
): string {
  if (!SEMVER.test(currentVersion)) {
    throw new Error(`Invalid current SemVer: ${currentVersion}`);
  }

  if (SEMVER.test(versionSpec)) {
    return versionSpec;
  }

  if (!VALID_BUMPS.has(versionSpec)) {
    throw new Error(`Invalid release bump: ${versionSpec}`);
  }

  const [core, prerelease = ""] = currentVersion.split("-", 2);

  const [major, minor, patch] = core.split(".").map(Number);

  switch (versionSpec) {
    case "major":
      return `${major + 1}.0.0`;

    case "minor":
      return `${major}.${minor + 1}.0`;

    case "patch":
      return `${major}.${minor}.${patch + 1}`;

    case "premajor":
      return `${major + 1}.0.0-0`;

    case "preminor":
      return `${major}.${minor + 1}.0-0`;

    case "prepatch":
      return `${major}.${minor}.${patch + 1}-0`;

    case "prerelease": {
      if (!prerelease) {
        return `${major}.${minor}.${patch + 1}-0`;
      }

      const parts = prerelease.split(".");

      const last = parts.at(-1);

      if (last && /^\d+$/.test(last)) {
        parts[parts.length - 1] = String(Number(last) + 1);
      } else {
        parts.push("0");
      }

      return `${major}.${minor}.${patch}-${parts.join(".")}`;
    }

    default:
      throw new Error(`Unsupported release bump: ${versionSpec}`);
  }
}

/**
 * Parse a release specification.
 *
 * @param {string} argument
 * Release specification in `<package>=<version>` form.
 *
 * @returns {{
 *   selector: string,
 *   versionSpec: string
 * }}
 * Parsed release specification.
 */
export function parseReleaseArgument(
  argument: string,
  options: ReleaseOptions = {},
) {
  if (!argument) {
    throw new Error("A package selector is required.");
  }

  if (!argument.includes("=")) {
    if (options.mode === "package-version") {
      return {
        selector: argument.trim(),
        versionSpec: null,
      };
    }

    throw new Error(
      "Usage: workspace-release <package>=<version|major|minor|patch|premajor|preminor|prepatch|prerelease>",
    );
  }

  const index = argument.indexOf("=");

  const selector = argument.slice(0, index).trim();

  const versionSpec = argument.slice(index + 1).trim();

  if (!selector) {
    throw new Error("A package selector is required.");
  }

  if (
    options.mode !== "package-version" &&
    !VALID_BUMPS.has(versionSpec) &&
    !SEMVER.test(versionSpec)
  ) {
    throw new Error(`Invalid version: ${versionSpec}`);
  }

  return {
    selector,
    versionSpec,
  };
}

/**
 * Group commit messages into changelog categories.
 *
 * @param {string[]} messages
 * Git commit messages.
 *
 * @returns {{
 *   Added: string[],
 *   Changed: string[],
 *   Fixed: string[],
 *   Removed: string[]
 * }}
 * Grouped release notes.
 */
export function releaseNotes(messages: string[]) {
  const groups: Record<"Added" | "Changed" | "Fixed" | "Removed", string[]> = {
    Added: [],
    Changed: [],
    Fixed: [],
    Removed: [],
  };

  const seen = new Set();

  for (const message of messages) {
    const firstLine = message
      .split("\n")
      .find((line) => line.trim())
      ?.trim();

    if (!firstLine || /^release(?:\([^)]*\))?:/i.test(firstLine)) {
      continue;
    }

    const match = firstLine.match(
      /^(feat|fix|refactor|perf|docs|style|test|build|ci|chore)(?:\([^)]*\))?(!)?:\s*(.+)$/i,
    );

    const type = match?.[1]?.toLowerCase();

    const breaking = Boolean(match?.[2]) || /BREAKING CHANGE:/i.test(message);

    const text = (match?.[3] || firstLine).replace(/\s*\(#\d+\)$/, "").trim();

    if (!text || seen.has(text)) {
      continue;
    }

    seen.add(text);

    if (breaking || /\bremove[ds]?\b/i.test(text)) {
      groups.Removed.push(text);
    } else if (type === "feat") {
      groups.Added.push(text);
    } else if (type === "fix") {
      groups.Fixed.push(text);
    } else {
      groups.Changed.push(text);
    }
  }

  return groups;
}

/**
 * Generate a changelog section.
 *
 * @param {string} version
 * Package version.
 *
 * @param {{
 *   Added: string[],
 *   Changed: string[],
 *   Fixed: string[],
 *   Removed: string[]
 * }} notes
 * Grouped release notes.
 *
 * @returns {string}
 * Markdown changelog section.
 */
export function changelogSection(
  version: string,
  notes: Record<string, string[]>,
): string {
  const sections = Object.entries(notes)
    .filter(([, entries]) => entries.length)
    .map(
      ([heading, entries]) =>
        `### ${heading}\n\n${entries.map((entry) => `- ${entry}`).join("\n")}`,
    );

  return `## ${version}\n\n${
    sections.join("\n\n") || "### Changed\n\n- Package release."
  }\n`;
}

/**
 * Get the configured package registry.
 *
 * @param {ReturnType<typeof packageInfo>} pkg
 * Workspace package.
 *
 * @returns {string}
 * Registry URL.
 */
/**
 * Read a curated changelog section for a release version.
 *
 * Supports both `## 1.2.3` and `## [1.2.3]` headings.
 */
export function existingChangelogSection(
  changelog: string,
  version: string,
): string | null {
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(
    `^## (?:\\[${escapedVersion}\\]|${escapedVersion})(?:\\s|$)`,
    "m",
  );
  const match = heading.exec(changelog);

  if (!match) {
    return null;
  }

  const start = match.index;
  const remainder = changelog.slice(start + match[0].length);
  const nextHeading = remainder.search(/^## /m);
  const end =
    nextHeading === -1
      ? changelog.length
      : start + match[0].length + nextHeading;

  return changelog.slice(start, end).trimEnd() + "\n";
}
function registryFor(pkg: ReturnType<typeof packageInfo>): string {
  return pkg.manifest.publishConfig?.registry || "https://registry.npmjs.org";
}

/**
 * Build the npm version command arguments for a releasable package.
 *
 * The repository root package is not an npm workspace member, so it must be
 * versioned from the repository root without --workspace. Nested workspace
 * packages continue to use their package name as the workspace selector.
 */
export function npmVersionArgs(
  pkg: { directory: string; manifest: { name: string } },
  versionSpec: string,
): string[] {
  const args = ["version", versionSpec];

  if (pkg.directory !== ".") {
    args.push("--workspace", pkg.manifest.name);
  }

  args.push("--git-tag-version=false");

  return args;
}

/**
 * Look up a package version in its configured registry.
 *
 * @param {string} root
 * Repository root.
 *
 * @param {ReturnType<typeof packageInfo>} pkg
 * Workspace package.
 *
 * @param {string} [version]
 * Optional version to check.
 *
 * @returns {{
 *   status: "published" | "not-published",
 *   version: string | null
 * }}
 * Registry state.
 */
function registryVersion(
  root: string,
  pkg: ReturnType<typeof packageInfo>,
  version?: string,
) {
  const registry = registryFor(pkg);

  const spec = version ? `${pkg.manifest.name}@${version}` : pkg.manifest.name;

  try {
    const publishedVersion = execFileSync(
      "npm",
      ["view", spec, "version", "--registry", registry],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ).trim();

    return {
      status: "published",
      version: publishedVersion,
    };
  } catch (error) {
    const commandError = error as Error & {
      stderr?: string | Buffer;
      stdout?: string | Buffer;
    };
    const stderr = String(commandError.stderr || "");

    const stdout = String(commandError.stdout || "");

    const details = `${stderr}\n${stdout}\n${commandError.message || ""}`;

    if (
      /E404|404 Not Found|is not in this registry|No match found for version/i.test(
        details,
      )
    ) {
      return {
        status: "not-published",
        version: null,
      };
    }

    throw new Error(
      `Unable to verify ${spec} in ${registry}: ${
        stderr.trim() || commandError.message || "registry lookup failed"
      }`,
    );
  }
}

/**
 * Find the previous release ref for a package.
 *
 * @param {string} root
 * Repository root.
 *
 * @param {string} selector
 * Package selector.
 *
 * @returns {string | null}
 * Previous tag or release commit.
 */
function tagState(root: string, tag: string) {
  const result = spawnSync(
    "git",
    ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}^{commit}`],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    return {
      name: tag,
      exists: false,
      atHead: false,
      commit: null,
    };
  }

  const commit = result.stdout.trim();
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  return {
    name: tag,
    exists: true,
    atHead: commit === head,
    commit,
  };
}

function previousReleaseRef(root: string, selector: string): string | null {
  const tags = execFileSync(
    "git",
    ["tag", "--list", `${selector}@*`, "--sort=-version:refname"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();

  const tag = tags.split("\n").find(Boolean);

  if (tag) {
    return tag;
  }

  const commit = execFileSync(
    "git",
    ["log", "-n", "1", "--format=%H", "--grep", `^release: ${selector}@[0-9]`],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();

  return commit || null;
}

/**
 * Read package-specific commits since the previous release.
 *
 * @param {string} root
 * Repository root.
 *
 * @param {ReturnType<typeof packageInfo>} pkg
 * Workspace package.
 *
 * @param {string | null} previousRef
 * Previous release ref.
 *
 * @returns {string[]}
 * Commit messages.
 */
function packageChanges(
  root: string,
  pkg: ReturnType<typeof packageInfo>,
  previousRef: string | null,
): string[] {
  const range = previousRef ? `${previousRef}..HEAD` : "HEAD";

  const log = execFileSync(
    "git",
    ["log", range, "--format=%B%x1e", "--", pkg.directory],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();

  return log
    ? log
        .split("\x1e")
        .map((message) => message.trim())
        .filter(Boolean)
    : [];
}

/**
 * Resolve the changelog content that belongs to a release.
 */
function releaseChangelog(
  root: string,
  pkg: ReturnType<typeof packageInfo>,
  version: string,
): { source: "existing" | "generated"; section: string; path: string } {
  const path = resolve(root, pkg.directory, "CHANGELOG.md");
  const current = existsSync(path)
    ? readFileSync(path, "utf8")
    : "# Changelog\n";
  const existing = existingChangelogSection(current, version);

  if (existing) {
    return { source: "existing", section: existing, path };
  }

  const previous = previousReleaseRef(root, pkg.directory);

  return {
    source: "generated",
    section: changelogSection(
      version,
      releaseNotes(packageChanges(root, pkg, previous)),
    ),
    path,
  };
}

/**
 * Write generated changelog content while preserving curated release sections.
 */
function applyReleaseChangelog(
  changelog: ReturnType<typeof releaseChangelog>,
): string {
  if (changelog.source === "existing") {
    return changelog.path;
  }

  const current = existsSync(changelog.path)
    ? readFileSync(changelog.path, "utf8")
    : "# Changelog\n";
  const body = current.replace(/^# Changelog\s*/, "");

  writeFileSync(
    changelog.path,
    `# Changelog\n\n${changelog.section}\n${body}`.trimEnd() + "\n",
  );

  return changelog.path;
}

/**
 * Build the complete release plan used by preview and execution.
 */
export function buildReleasePlan(
  root: string,
  pkg: ReturnType<typeof packageInfo>,
  selector: string,
  mode: "bump" | "exact" | "package-version",
  versionSpec: string | null,
) {
  const currentVersion = pkg.manifest.version;
  const nextVersion =
    mode === "package-version"
      ? currentVersion
      : resolveNextVersion(currentVersion, versionSpec!);
  const registry = registryFor(pkg);
  const published = registryVersion(root, pkg);
  const proposed = registryVersion(root, pkg, nextVersion);
  const identity = releaseIdentity(pkg, nextVersion);
  const tag = tagState(root, identity.tagName);
  const changelog = releaseChangelog(root, pkg, nextVersion);
  const previousRelease = previousReleaseRef(root, pkg.directory);
  const alreadyPublished = proposed.status === "published";
  const canRelease = !alreadyPublished && !tag.exists;
  const reason = alreadyPublished
    ? `${pkg.manifest.name}@${nextVersion} is already published.`
    : tag.exists
      ? tag.atHead
        ? `Git tag ${identity.tagName} already exists at HEAD.`
        : `Git tag ${identity.tagName} already exists at ${tag.commit} and will not be moved.`
      : null;
  const versionCommand =
    mode === "package-version"
      ? null
      : {
          command: "npm",
          args: npmVersionArgs(pkg, versionSpec!),
          cwd: root,
        };

  return {
    package: {
      name: pkg.manifest.name,
      selector,
      directory: pkg.directory,
      manifest: pkg.file,
    },
    mode,
    versionRequest: versionSpec,
    currentVersion,
    nextVersion,
    registry,
    latestPublished: published.status === "published" ? published.version : "",
    alreadyPublished,
    identity,
    tag,
    canRelease,
    reason,
    previousRelease,
    changelog,
    versionCommand,
    files:
      mode === "package-version"
        ? []
        : [pkg.file, resolve(root, "package-lock.json"), changelog.path],
  };
}
/**
 * Create or preview a package release.
 *
 * @param {string} argument
 * Release specification in `<package>=<version>` form.
 *
 * @param {ReleaseOptions} [options={}]
 * Release options.
 *
 * @returns {{
 *   registry: string,
 *   latestPublished: string,
 *   currentVersion: string,
 *   nextVersion: string,
 *   alreadyPublished: boolean,
 *   previousRelease: string | null,
 *   changelog: string
 * } | undefined}
 * Dry-run information when `dryRun` is enabled.
 */
export function release(argument: string, options: ReleaseOptions = {}) {
  const { selector, versionSpec: argumentVersionSpec } = parseReleaseArgument(
    argument,
    options,
  );

  const mode = options.mode || "bump";

  if (!RELEASE_MODES.has(mode)) {
    throw new Error(`Invalid release mode: ${mode}`);
  }

  const versionSpec =
    mode === "package-version" ? null : options.version || argumentVersionSpec;

  if (mode === "bump" && (!versionSpec || !VALID_BUMPS.has(versionSpec))) {
    throw new Error(`Invalid release bump: ${versionSpec}`);
  }

  if (mode === "exact" && (!versionSpec || !SEMVER.test(versionSpec))) {
    throw new Error(`Invalid exact SemVer: ${versionSpec}`);
  }

  const root = repositoryRoot();
  const pkg = packageInfo(root, selector);

  if (pkg.manifest.private) {
    throw new Error(`${pkg.manifest.name} is private and cannot be released.`);
  }

  if (
    execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
  ) {
    throw new Error(
      "Working tree must be clean before creating a package release.",
    );
  }

  const dependencies = dependencyCheck(root, pkg);

  if (!options.json) {
    printDependencyCheck(dependencies);
  }

  assertDependencies(dependencies);

  const plan = buildReleasePlan(root, pkg, selector, mode, versionSpec);

  if (options.dryRun) {
    if (!options.json) {
      const versionCommand = plan.versionCommand
        ? [plan.versionCommand.command, ...plan.versionCommand.args].join(" ")
        : "none (package.json version is used as-is)";
      const changedFiles = plan.files.length
        ? plan.files.map((file) => `  - ${file}`).join("\n")
        : "  - none";

      console.log(`
${style.bold(style.cyan("Release preview"))}

Package:            ${pkg.manifest.name}
Registry:           ${plan.registry}
Current version:    ${style.cyan(plan.currentVersion)}
Version to release: ${style.bold(style.green(plan.nextVersion))}
Git tag:            ${plan.identity.tagName}
Can release:        ${plan.canRelease ? style.green("yes") : style.red("no")}

${style.bold("Execution plan")}
  Version command: ${versionCommand}
  Changelog source: ${plan.changelog.source}
  Files that would change:
${changedFiles}

${style.bold("Release readiness")}
  ${plan.reason || `${pkg.manifest.name}@${plan.nextVersion} is available to release.`}

${style.dim(
  "Dry run only — this is the same resolved plan that real execution will use.",
)}

${style.bold(style.cyan("Release notes"))}

${plan.changelog.section}`);
    }

    return {
      operation: "release",
      status: plan.canRelease ? "preview" : "warning",
      dryRun: true,
      ...plan,
      changelog: plan.changelog.section,
      changelogSource: plan.changelog.source,
    };
  }

  if (!plan.canRelease) {
    throw new Error(
      plan.reason || "Resolved release target is not releasable.",
    );
  }

  const operationRunOptions: ExecFileSyncOptions = options.json
    ? { stdio: ["ignore", "ignore", "inherit"] }
    : { stdio: "inherit" };

  if (plan.versionCommand) {
    execFileSync(plan.versionCommand.command, plan.versionCommand.args, {
      cwd: plan.versionCommand.cwd,
      ...operationRunOptions,
    });

    const actualVersion = (
      JSON.parse(readFileSync(pkg.file, "utf8")) as { version: string }
    ).version;

    if (actualVersion !== plan.nextVersion) {
      throw new Error(
        `Version command produced ${actualVersion}; expected ${plan.nextVersion}.`,
      );
    }

    applyReleaseChangelog(plan.changelog);

    execFileSync("git", ["add", ...plan.files], {
      cwd: root,
      ...operationRunOptions,
    });

    execFileSync("git", ["commit", "-m", `release: ${plan.identity.tagName}`], {
      cwd: root,
      ...operationRunOptions,
    });
  }

  execFileSync("git", ["tag", plan.identity.tagName], {
    cwd: root,
    ...operationRunOptions,
  });

  const result = {
    operation: "release",
    status: "success",
    dryRun: false,
    ...plan,
    tag: {
      ...plan.tag,
      name: plan.identity.tagName,
      exists: true,
      atHead: true,
      commit: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    },
    changelog: plan.changelog.section,
    changelogSource: plan.changelog.source,
    git: {
      committed: Boolean(plan.versionCommand),
      tagged: true,
    },
  };

  if (!options.json) {
    console.log(`
Created release ${plan.identity.tagName}

Push the release commit and tag with:

  git push --follow-tags`);
  }

  return result;
}
/**
 * Determine whether a CLI executable is available on PATH.
 *
 * @param {string} command
 * Executable name.
 *
 * @returns {boolean}
 * Whether the executable is available.
 */
function commandExists(command: string): boolean {
  const lookupCommand = process.platform === "win32" ? "where" : "which";

  const result = spawnSync(lookupCommand, [command], {
    stdio: "ignore",
  });

  return result.status === 0;
}

/**
 * Run an interactive fzf selection.
 *
 * @param {string[]} choices
 * Values presented to fzf.
 *
 * @param {string} prompt
 * Prompt displayed by fzf.
 *
 * @returns {string | undefined}
 * Selected value, or `undefined` when selection is cancelled.
 */
function selectWithFzf(choices: string[], prompt: string): string | undefined {
  if (!process.stdin.isTTY) {
    throw new Error("Interactive selection requires a terminal.");
  }

  if (!commandExists("fzf")) {
    throw new Error(
      [
        "fzf is required for interactive selection.",
        "Install fzf or provide the release arguments explicitly.",
      ].join("\n"),
    );
  }

  if (!choices.length) {
    return undefined;
  }

  const result = spawnSync(
    "fzf",
    [
      "--prompt",
      `${prompt} > `,
      "--height",
      "40%",
      "--layout",
      "reverse",
      "--border",
      "--select-1",
      "--exit-0",
    ],
    {
      input: `${choices.join("\n")}\n`,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "inherit"],
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status === 1 || result.status === 130) {
    return undefined;
  }

  if (result.status !== 0) {
    throw new Error(`fzf exited with status ${result.status}.`);
  }

  const selected = result.stdout.trim();

  return selected || undefined;
}

/**
 * Get all non-private packages under the repository packages directory.
 *
 * @param {string} root
 * Repository root.
 *
 * @returns {ReturnType<typeof packageInfo>[]}
 * Releasable workspace packages.
 */
function releasablePackages(root: string): ReturnType<typeof packageInfo>[] {
  const packagesDirectory = resolve(root, "packages");

  if (!existsSync(packagesDirectory)) {
    return [];
  }

  return readdirSync(packagesDirectory, {
    withFileTypes: true,
  })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(resolve(packagesDirectory, entry.name, "package.json")),
    )
    .map((entry) => packageInfo(root, entry.name))
    .filter((pkg) => !pkg.manifest.private)
    .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

/**
 * Select a package using fzf.
 *
 * @param {string} root
 * Repository root.
 *
 * @returns {string | undefined}
 * Selected package name.
 */
function selectPackageWithFzf(root: string): string | undefined {
  const packages = releasablePackages(root);

  if (!packages.length) {
    throw new Error("No releasable packages were found under packages/*.");
  }

  return selectWithFzf(
    packages.map((pkg) => pkg.manifest.name),
    "Package",
  );
}

/**
 * Select a semantic-version bump using fzf.
 *
 * @returns {string | undefined}
 * Selected bump.
 */
function selectVersionBumpWithFzf(): string | undefined {
  return selectWithFzf(
    [
      "patch",
      "minor",
      "major",
      "prerelease",
      "prepatch",
      "preminor",
      "premajor",
    ],
    "Version",
  );
}

/**
 * Resolve a CLI release specification.
 *
 * Explicit `<package>=<version>` input is preserved.
 *
 * A package supplied without a version uses `--version` when present,
 * otherwise fzf is used for bump selection.
 *
 * When no package is supplied, fzf selects the package first.
 *
 * @param {string | undefined} argument
 * Optional package or release specification.
 *
 * @param {ReleaseOptions} options
 * Commander options.
 *
 * @returns {string | undefined}
 * Normalized `<package>=<version>` release specification.
 */
function resolveCliReleaseArgument(
  argument: string | undefined,
  options: ReleaseOptions,
): string | undefined {
  if (argument?.includes("=")) {
    return argument;
  }

  if (!options.fzf && !argument) {
    throw new Error("A package selector is required when --no-fzf is used.");
  }

  const root = repositoryRoot();

  const selector = argument || selectPackageWithFzf(root);

  if (!selector) {
    return undefined;
  }

  if (options.mode === "package-version") {
    return selector;
  }

  if (options.mode === "exact") {
    if (!options.version) {
      throw new Error("--mode exact requires --version <semver>.");
    }

    return `${selector}=${options.version}`;
  }

  const versionSpec =
    options.version || (options.fzf ? selectVersionBumpWithFzf() : undefined);

  if (!versionSpec) {
    return undefined;
  }

  return `${selector}=${versionSpec}`;
}

/**
 * Execute the workspace-release CLI command.
 *
 * @param {string | undefined} argument
 * Optional package or `<package>=<version>` specification.
 *
 * @param {ReleaseOptions} options
 * Commander options.
 *
 * @returns {void}
 */
export function releaseWorkspacePackage(
  argument: string | undefined,
  options: ReleaseOptions,
): void {
  const releaseArgument = resolveCliReleaseArgument(argument, options);

  if (!releaseArgument) {
    console.log("Release selection cancelled.");

    return;
  }

  const result = release(releaseArgument, options);

  if (options.json && result) {
    console.log(JSON.stringify(result, null, 2));
  }
}

/**
 * Determine whether this module is the process entry point.
 *
 * @returns {boolean}
 * Whether this module was executed directly.
 */
function isMainModule(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  return import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
}

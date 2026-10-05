#!/usr/bin/env node
import { program, Argument, Option } from "commander";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
function releaseIdentity(pkg, version = pkg.manifest.version) {
  const packageName = pkg.manifest.name?.trim();
  const packageDirectory = pkg.directory.replace(/^\.\//, "").replace(/\/$/, "");
  const resolvedVersion = version?.trim();
  if (!packageName) {
    throw new Error("Package name is required for release identity.");
  }
  if (!packageDirectory) {
    throw new Error("Package directory is required for release identity.");
  }
  if (!resolvedVersion) {
    throw new Error("Version is required for release identity.");
  }
  return {
    packageName,
    packageDirectory,
    version: resolvedVersion,
    tagName: `${packageDirectory}@${resolvedVersion}`,
    tagPrefix: `${packageDirectory}@`,
    releaseName: `${packageName} v${resolvedVersion}`
  };
}
function workspacePatterns(root) {
  const manifest = JSON.parse(
    readFileSync(resolve(root, "package.json"), "utf8")
  );
  const workspaces = Array.isArray(manifest.workspaces) ? manifest.workspaces : manifest.workspaces?.packages;
  if (!Array.isArray(workspaces)) return [];
  return workspaces;
}
function workspacePackages(root) {
  const directories = workspacePatterns(root).flatMap((pattern) => {
    const normalized = pattern.replace(/^\.\//, "").replace(/\/$/, "");
    if (!normalized.endsWith("/*")) {
      return existsSync(resolve(root, normalized, "package.json")) ? [normalized] : [];
    }
    const parent = normalized.slice(0, -2);
    const parentDir = resolve(root, parent);
    if (!existsSync(parentDir)) return [];
    return readdirSync(parentDir, { withFileTypes: true }).filter(
      (entry) => entry.isDirectory() && existsSync(resolve(parentDir, entry.name, "package.json"))
    ).map((entry) => `${parent}/${entry.name}`);
  });
  return [...new Set(directories)].map((directory) => {
    const file = resolve(root, directory, "package.json");
    const manifest = JSON.parse(
      readFileSync(file, "utf8")
    );
    return { directory, file, manifest };
  }).filter(
    (pkg) => typeof pkg.manifest.name === "string" && typeof pkg.manifest.version === "string"
  );
}
function packageInfo(root, selector) {
  const packages = workspacePackages(root);
  const normalized = selector?.replace(/^\.\//, "");
  if (!normalized || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../") || normalized.endsWith("/..")) {
    throw new Error(
      `Package selector must identify a workspace package: ${selector}`
    );
  }
  const pkg = packages.find(
    ({ directory, manifest }) => normalized === directory || normalized === directory.split("/").at(-1) || normalized === manifest.name
  );
  if (!pkg) throw new Error(`Package not found: ${selector}`);
  return pkg;
}
function repositoryRoot() {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}
function parseOutdated(raw) {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Unable to parse npm outdated results.");
  }
}
function classifyOutdated(outdated) {
  return Object.entries(outdated).map(([name, info]) => {
    const current = info.current ?? null;
    const wanted = info.wanted ?? null;
    const latest = info.latest ?? null;
    const fail = Boolean(current && wanted && current !== wanted);
    return {
      name,
      current,
      wanted,
      latest,
      level: fail ? "fail" : "warn",
      reason: fail ? "installed dependency is behind wanted" : "newer version exists outside declared range"
    };
  });
}
function dependencyCheck(root, pkg) {
  let outdated = {};
  const outdatedResult = spawnSync(
    "npm",
    ["outdated", "--workspace", pkg.manifest.name, "--json"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
  const outdatedOutput = outdatedResult.stdout.trim();
  if (outdatedResult.error) {
    throw outdatedResult.error;
  }
  if (outdatedResult.status !== 0 && outdatedResult.status !== 1 && !outdatedOutput) {
    throw new Error(outdatedResult.stderr.trim() || "npm outdated failed.");
  }
  outdated = parseOutdated(outdatedOutput);
  const internal = new Map(
    workspacePackages(root).map((item) => [item.manifest.name, item])
  );
  const results = classifyOutdated(outdated);
  const declared = {
    ...pkg.manifest.dependencies ?? {},
    ...pkg.manifest.optionalDependencies ?? {},
    ...pkg.manifest.devDependencies ?? {}
  };
  for (const [name, range] of Object.entries(declared)) {
    const workspace = internal.get(name);
    if (!workspace || range === workspace.manifest.version) {
      continue;
    }
    const existing = results.find((item) => item.name === name);
    const detail = {
      name,
      declared: range,
      workspace: workspace.manifest.version,
      level: "fail",
      reason: "internal dependency does not match workspace version"
    };
    if (existing) {
      Object.assign(existing, detail);
    } else {
      results.push(detail);
    }
  }
  return results;
}
function printDependencyCheck(results) {
  if (!results.length) {
    return;
  }
  console.log("\nDependencies needing attention:");
  for (const item of results) {
    const versions = item.workspace ? `declared ${item.declared}, workspace ${item.workspace}` : `current ${item.current ?? "missing"}, wanted ${item.wanted ?? "unknown"}, latest ${item.latest ?? "unknown"}`;
    console.log(
      `  ${item.name}: ${versions} — ${item.level.toUpperCase()} — ${item.reason}`
    );
  }
}
function assertDependencies(results) {
  const failures = results.filter((item) => item.level === "fail");
  if (failures.length) {
    throw new Error(
      `Dependency check failed for ${failures.map((item) => item.name).join(", ")}.`
    );
  }
}
const VALID_BUMPS = /* @__PURE__ */ new Set([
  "major",
  "minor",
  "patch",
  "premajor",
  "preminor",
  "prepatch",
  "prerelease"
]);
const RELEASE_MODES = /* @__PURE__ */ new Set(["bump", "exact", "package-json"]);
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const COLOR = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);
function ansi(code, value) {
  return COLOR ? `\x1B[${code}m${value}\x1B[0m` : value;
}
const style = {
  bold: (value) => ansi("1", value),
  cyan: (value) => ansi("36", value),
  green: (value) => ansi("32", value),
  yellow: (value) => ansi("33", value),
  red: (value) => ansi("31", value),
  dim: (value) => ansi("2", value)
};
function resolveNextVersion(currentVersion, versionSpec) {
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
function parseReleaseArgument(argument, options = {}) {
  if (!argument) {
    throw new Error("A package selector is required.");
  }
  if (!argument.includes("=")) {
    if (options.mode === "package-json") {
      return {
        selector: argument.trim(),
        versionSpec: null
      };
    }
    throw new Error(
      "Usage: workspace-release <package>=<version|major|minor|patch|premajor|preminor|prepatch|prerelease>"
    );
  }
  const index = argument.indexOf("=");
  const selector = argument.slice(0, index).trim();
  const versionSpec = argument.slice(index + 1).trim();
  if (!selector) {
    throw new Error("A package selector is required.");
  }
  if (options.mode !== "package-json" && !VALID_BUMPS.has(versionSpec) && !SEMVER.test(versionSpec)) {
    throw new Error(`Invalid version: ${versionSpec}`);
  }
  return {
    selector,
    versionSpec
  };
}
function releaseNotes(messages) {
  const groups = {
    Added: [],
    Changed: [],
    Fixed: [],
    Removed: []
  };
  const seen = /* @__PURE__ */ new Set();
  for (const message of messages) {
    const firstLine = message.split("\n").find((line) => line.trim())?.trim();
    if (!firstLine || /^release(?:\([^)]*\))?:/i.test(firstLine)) {
      continue;
    }
    const match = firstLine.match(
      /^(feat|fix|refactor|perf|docs|style|test|build|ci|chore)(?:\([^)]*\))?(!)?:\s*(.+)$/i
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
function changelogSection(version, notes) {
  const sections = Object.entries(notes).filter(([, entries]) => entries.length).map(
    ([heading, entries]) => `### ${heading}

${entries.map((entry) => `- ${entry}`).join("\n")}`
  );
  return `## ${version}

${sections.join("\n\n") || "### Changed\n\n- Package release."}
`;
}
function registryFor(pkg) {
  return pkg.manifest.publishConfig?.registry || "https://registry.npmjs.org";
}
function registryVersion(root, pkg, version) {
  const registry = registryFor(pkg);
  const spec = version ? `${pkg.manifest.name}@${version}` : pkg.manifest.name;
  try {
    const publishedVersion = execFileSync(
      "npm",
      ["view", spec, "version", "--registry", registry],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    ).trim();
    return {
      status: "published",
      version: publishedVersion
    };
  } catch (error) {
    const commandError = error;
    const stderr = String(commandError.stderr || "");
    const stdout = String(commandError.stdout || "");
    const details = `${stderr}
${stdout}
${commandError.message || ""}`;
    if (/E404|404 Not Found|is not in this registry|No match found for version/i.test(
      details
    )) {
      return {
        status: "not-published",
        version: null
      };
    }
    throw new Error(
      `Unable to verify ${spec} in ${registry}: ${stderr.trim() || commandError.message || "registry lookup failed"}`
    );
  }
}
function tagState(root, tag) {
  const commit = execFileSync("git", ["rev-list", "-n", "1", tag], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  if (!commit) {
    return {
      name: tag,
      exists: false,
      atHead: false,
      commit: null
    };
  }
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  return {
    name: tag,
    exists: true,
    atHead: commit === head,
    commit
  };
}
function previousReleaseRef(root, selector) {
  const tags = execFileSync(
    "git",
    ["tag", "--list", `${selector}@*`, "--sort=-version:refname"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
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
      stdio: ["ignore", "pipe", "pipe"]
    }
  ).trim();
  return commit || null;
}
function packageChanges(root, pkg, previousRef) {
  const range = previousRef ? `${previousRef}..HEAD` : "HEAD";
  const log = execFileSync(
    "git",
    ["log", range, "--format=%B%x1e", "--", pkg.directory],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  ).trim();
  return log ? log.split("").map((message) => message.trim()).filter(Boolean) : [];
}
function updateChangelog(root, pkg, version, selector) {
  const changelog = resolve(root, pkg.directory, "CHANGELOG.md");
  const previous = previousReleaseRef(root, pkg.directory);
  const section = changelogSection(
    version,
    releaseNotes(packageChanges(root, pkg, previous))
  );
  const current = existsSync(changelog) ? readFileSync(changelog, "utf8") : "# Changelog\n";
  const body = current.replace(/^# Changelog\s*/, "");
  writeFileSync(
    changelog,
    `# Changelog

${section}
${body}`.trimEnd() + "\n"
  );
  return changelog;
}
function release(argument, options = {}) {
  const { selector, versionSpec: argumentVersionSpec } = parseReleaseArgument(
    argument,
    options
  );
  const mode = options.mode || "bump";
  if (!RELEASE_MODES.has(mode)) {
    throw new Error(`Invalid release mode: ${mode}`);
  }
  const versionSpec = mode === "package-json" ? null : options.version || argumentVersionSpec;
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
  if (execFileSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim()) {
    throw new Error(
      "Working tree must be clean before creating a package release."
    );
  }
  const dependencies = dependencyCheck(root, pkg);
  if (!options.json) {
    printDependencyCheck(dependencies);
  }
  assertDependencies(dependencies);
  if (options.dryRun) {
    let nextVersion = pkg.manifest.version;
    if (mode !== "package-json") {
      nextVersion = resolveNextVersion(pkg.manifest.version, versionSpec);
    }
    const registry = registryFor(pkg);
    const published = registryVersion(root, pkg);
    const proposed = registryVersion(root, pkg, nextVersion);
    const latestPublished = published.status === "published" ? published.version : "";
    const alreadyPublished = proposed.status === "published";
    const identity2 = releaseIdentity(pkg, nextVersion);
    const gitTag = tagState(root, identity2.tagName);
    const canRelease = !alreadyPublished && !gitTag.exists;
    const reason = alreadyPublished ? `${pkg.manifest.name}@${nextVersion} is already published.` : gitTag.exists ? gitTag.atHead ? `Git tag ${identity2.tagName} already exists at HEAD.` : `Git tag ${identity2.tagName} already exists at ${gitTag.commit} and will not be moved.` : null;
    const previous = previousReleaseRef(root, pkg.directory);
    const section = changelogSection(
      nextVersion,
      releaseNotes(packageChanges(root, pkg, previous))
    );
    const registryName = registry === "https://npm.pkg.github.com" ? "GitHub Packages" : registry === "https://registry.npmjs.org" ? "npm" : registry;
    const selection = mode === "package-json" ? "Release the package.json version without changing it." : mode === "exact" ? "Release the explicitly requested version." : `Increment the ${versionSpec} version.`;
    const versionChange = mode === "package-json" ? "" : `
  ${pkg.manifest.version} → ${nextVersion}`;
    const registryStatus = alreadyPublished ? `${pkg.manifest.name}@${nextVersion} is already published.` : `${pkg.manifest.name}@${nextVersion} is not published.
  This version is available to publish.`;
    const previousRelease = previous || "No previous release was found.";
    const publishedDisplay = latestPublished ? style.cyan(latestPublished) : style.yellow("Not published");
    const releaseDisplay = style.bold(style.green(nextVersion));
    const statusDisplay = canRelease ? style.green(registryStatus) : style.red(reason || registryStatus);
    const previousDisplay = previous ? style.cyan(previousRelease) : style.yellow(previousRelease);
    if (!options.json) {
      console.log(`
${style.bold(style.cyan("Release preview"))}

Package:          ${pkg.manifest.name}
Registry:         ${registryName}
Published:        ${publishedDisplay}
Package version:  ${style.cyan(pkg.manifest.version)}

${style.bold("Release selection")}
  ${selection}${versionChange}
  Version to release: ${releaseDisplay}

${style.bold("Release readiness")}
  ${statusDisplay}

${style.bold("Previous release")}
  ${previousDisplay}

${style.dim(
        "Dry run only — no files, commits, tags, or packages will be changed."
      )}

${style.bold(style.cyan("Proposed changelog"))}

${section}`);
    }
    return {
      operation: "release",
      status: canRelease ? "preview" : "warning",
      dryRun: true,
      package: {
        name: pkg.manifest.name,
        selector,
        directory: pkg.directory
      },
      mode,
      versionRequest: versionSpec,
      registry,
      latestPublished,
      currentVersion: pkg.manifest.version,
      nextVersion,
      identity: identity2,
      alreadyPublished,
      tag: gitTag,
      canRelease,
      reason,
      previousRelease: previous,
      changelog: section
    };
  }
  const operationRunOptions = options.json ? { stdio: ["ignore", "ignore", "inherit"] } : { stdio: "inherit" };
  if (mode === "package-json") {
    const version2 = pkg.manifest.version;
    const identity2 = releaseIdentity(pkg, version2);
    const tag2 = identity2.tagName;
    const gitTag = tagState(root, tag2);
    if (gitTag.exists) {
      throw new Error(
        gitTag.atHead ? `Git tag ${identity2.tagName} already exists at HEAD.` : `Git tag ${identity2.tagName} already exists at ${gitTag.commit} and will not be moved.`
      );
    }
    if (registryVersion(root, pkg, version2).status === "published") {
      throw new Error(
        `${pkg.manifest.name}@${version2} is already published to ${registryFor(pkg)}.`
      );
    }
    execFileSync("git", ["tag", tag2], {
      cwd: root,
      ...operationRunOptions
    });
    const result2 = {
      operation: "release",
      status: "success",
      dryRun: false,
      package: {
        name: pkg.manifest.name,
        selector,
        directory: pkg.directory
      },
      mode,
      versionRequest: null,
      registry: registryFor(pkg),
      currentVersion: version2,
      nextVersion: version2,
      identity: identity2,
      tag: {
        name: tag2,
        exists: true,
        atHead: true,
        commit: execFileSync("git", ["rev-parse", "HEAD"], {
          cwd: root,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"]
        }).trim()
      },
      git: {
        committed: false,
        tagged: true
      }
    };
    if (!options.json) {
      console.log(`Created tag ${tag2} at HEAD.`);
    }
    return result2;
  }
  execFileSync(
    "npm",
    [
      "version",
      versionSpec,
      "--workspace",
      pkg.manifest.name,
      "--git-tag-version=false"
    ],
    {
      cwd: root,
      ...operationRunOptions
    }
  );
  const version = JSON.parse(readFileSync(pkg.file, "utf8")).version;
  if (registryVersion(root, pkg, version).status === "published") {
    execFileSync("git", ["checkout", "--", pkg.file, "package-lock.json"], {
      cwd: root,
      ...operationRunOptions
    });
    throw new Error(
      `${pkg.manifest.name}@${version} is already published to ${registryFor(pkg)}.`
    );
  }
  const identity = releaseIdentity(pkg, version);
  const tag = identity.tagName;
  const changelog = updateChangelog(root, pkg, version, pkg.directory);
  execFileSync("git", ["add", pkg.file, "package-lock.json", changelog], {
    cwd: root,
    ...operationRunOptions
  });
  execFileSync("git", ["commit", "-m", `release: ${tag}`], {
    cwd: root,
    ...operationRunOptions
  });
  execFileSync("git", ["tag", tag], {
    cwd: root,
    ...operationRunOptions
  });
  const result = {
    operation: "release",
    status: "success",
    dryRun: false,
    package: {
      name: pkg.manifest.name,
      selector,
      directory: pkg.directory
    },
    mode,
    versionRequest: versionSpec,
    registry: registryFor(pkg),
    currentVersion: pkg.manifest.version,
    nextVersion: version,
    identity,
    tag,
    changelog,
    git: {
      committed: true,
      tagged: true
    }
  };
  if (!options.json) {
    console.log(`
Created release ${tag}

Push the release commit and tag with:

  git push --follow-tags`);
  }
  return result;
}
function commandExists(command) {
  const lookupCommand = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(lookupCommand, [command], {
    stdio: "ignore"
  });
  return result.status === 0;
}
function selectWithFzf(choices, prompt) {
  if (!process.stdin.isTTY) {
    throw new Error("Interactive selection requires a terminal.");
  }
  if (!commandExists("fzf")) {
    throw new Error(
      [
        "fzf is required for interactive selection.",
        "Install fzf or provide the release arguments explicitly."
      ].join("\n")
    );
  }
  if (!choices.length) {
    return void 0;
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
      "--exit-0"
    ],
    {
      input: `${choices.join("\n")}
`,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "inherit"]
    }
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status === 1 || result.status === 130) {
    return void 0;
  }
  if (result.status !== 0) {
    throw new Error(`fzf exited with status ${result.status}.`);
  }
  const selected = result.stdout.trim();
  return selected || void 0;
}
function releasablePackages(root) {
  const packagesDirectory = resolve(root, "packages");
  if (!existsSync(packagesDirectory)) {
    return [];
  }
  return readdirSync(packagesDirectory, {
    withFileTypes: true
  }).filter(
    (entry) => entry.isDirectory() && existsSync(resolve(packagesDirectory, entry.name, "package.json"))
  ).map((entry) => packageInfo(root, entry.name)).filter((pkg) => !pkg.manifest.private).sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}
function selectPackageWithFzf(root) {
  const packages = releasablePackages(root);
  if (!packages.length) {
    throw new Error("No releasable packages were found under packages/*.");
  }
  return selectWithFzf(
    packages.map((pkg) => pkg.manifest.name),
    "Package"
  );
}
function selectVersionBumpWithFzf() {
  return selectWithFzf(
    [
      "patch",
      "minor",
      "major",
      "prerelease",
      "prepatch",
      "preminor",
      "premajor"
    ],
    "Version"
  );
}
function resolveCliReleaseArgument(argument, options) {
  if (argument?.includes("=")) {
    return argument;
  }
  if (!options.fzf && !argument) {
    throw new Error("A package selector is required when --no-fzf is used.");
  }
  const root = repositoryRoot();
  const selector = argument || selectPackageWithFzf(root);
  if (!selector) {
    return void 0;
  }
  if (options.mode === "package-json") {
    return selector;
  }
  if (options.mode === "exact") {
    if (!options.version) {
      throw new Error("--mode exact requires --version <semver>.");
    }
    return `${selector}=${options.version}`;
  }
  const versionSpec = options.version || (options.fzf ? selectVersionBumpWithFzf() : void 0);
  if (!versionSpec) {
    return void 0;
  }
  return `${selector}=${versionSpec}`;
}
function releaseWorkspacePackage(argument, options) {
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
program.name("workspace-release").description("Preview or create a workspace package release.").addArgument(
  new Argument(
    "[release]",
    "Package selector or package=version, for example workspace-tools or workspace-tools=patch"
  )
).addOption(
  new Option("--mode <mode>", "Version mode").choices([
    "bump",
    "exact",
    "package-json"
  ])
).option("--version <version>", "Override the version or bump").option("-d, --dry-run", "Preview without changing repository files").option("-j, --json", "Print the operation result as JSON").option("--no-fzf", "Disable automatic fzf selection").action(async (release2, options) => {
  await releaseWorkspacePackage(release2, options);
});
await program.parseAsync();

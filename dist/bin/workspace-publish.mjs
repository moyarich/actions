#!/usr/bin/env node
import { program, Argument, Option } from "commander";
import { existsSync, readdirSync, readFileSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
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
function workspaceDependencies(root, pkg) {
  const byName = new Map(
    workspacePackages(root).map((item) => [item.manifest.name, item])
  );
  const dependencyNames = /* @__PURE__ */ new Set([
    ...Object.keys(pkg.manifest.dependencies ?? {}),
    ...Object.keys(pkg.manifest.optionalDependencies ?? {})
  ]);
  return [...dependencyNames].map((name) => byName.get(name)).filter((pkg2) => pkg2 !== void 0);
}
function workspacePublishOrder(root, pkg) {
  const order = [];
  const visiting = /* @__PURE__ */ new Set();
  const visited = /* @__PURE__ */ new Set();
  function visit(current) {
    if (visited.has(current.manifest.name)) return;
    if (visiting.has(current.manifest.name)) {
      throw new Error(
        `Circular workspace dependency involving ${current.manifest.name}.`
      );
    }
    visiting.add(current.manifest.name);
    for (const dependency of workspaceDependencies(root, current))
      visit(dependency);
    visiting.delete(current.manifest.name);
    visited.add(current.manifest.name);
    order.push(current);
  }
  visit(pkg);
  return order;
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
function registryConfig(registry) {
  switch (registry) {
    case "github":
      return {
        url: "https://npm.pkg.github.com",
        host: "npm.pkg.github.com",
        token: process.env["_GITHUB_TOKEN"] || process.env["NODE_AUTH_TOKEN"]
      };
    case "npm":
      return {
        url: "https://registry.npmjs.org",
        host: "registry.npmjs.org",
        token: process.env["_NPM_TOKEN"] || process.env["NODE_AUTH_TOKEN"]
      };
    default:
      throw new Error("Registry must be github, npm, or both.");
  }
}
function destinations(registry) {
  return registry === "both" ? ["github", "npm"] : [registry];
}
function commandExists(command) {
  const lookupCommand = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(lookupCommand, [command], {
    stdio: "ignore"
  });
  return result.status === 0;
}
function publishablePackages(root) {
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
  if (!process.stdin.isTTY) {
    throw new Error(
      "A package selector is required when stdin is not interactive."
    );
  }
  if (!commandExists("fzf")) {
    throw new Error(
      [
        "fzf is required for interactive package selection.",
        "Install fzf or pass a package selector explicitly:",
        "  workspace-publish <package>"
      ].join("\n")
    );
  }
  const packages = publishablePackages(root);
  if (!packages.length) {
    throw new Error("No publishable packages were found under packages/*.");
  }
  const choices = packages.map((pkg) => pkg.manifest.name).join("\n");
  const result = spawnSync(
    "fzf",
    [
      "--prompt",
      "Package > ",
      "--height",
      "40%",
      "--layout",
      "reverse",
      "--border",
      "--select-1",
      "--exit-0"
    ],
    {
      cwd: root,
      input: `${choices}
`,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "inherit"]
    }
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  const selector = result.stdout.trim();
  if (!selector) {
    return void 0;
  }
  return selector;
}
function packageRegistryState(pkg, registry) {
  const config = registryConfig(registry);
  const args = [
    "view",
    `${pkg.manifest.name}@${pkg.manifest.version}`,
    "version",
    "--registry",
    config.url,
    "--json"
  ];
  const env = {
    ...process.env
  };
  if (config.token) {
    env.NODE_AUTH_TOKEN = config.token;
  }
  try {
    execFileSync("npm", args, {
      env,
      stdio: "pipe"
    });
    return "published";
  } catch (error) {
    const commandError = error;
    const output = [
      commandError.stdout ?? "",
      commandError.stderr ?? "",
      commandError.message
    ].join("\n");
    if (/E404|404 Not Found|is not in this registry/i.test(output)) {
      return "missing";
    }
    throw new Error(
      `Could not check ${pkg.manifest.name}@${pkg.manifest.version} on ${registry}: ${commandError.message}`
    );
  }
}
function packageGitTagState(root, pkg) {
  const identity = releaseIdentity(pkg);
  const name = identity.tagName;
  let commit = "";
  try {
    commit = execFileSync("git", ["rev-list", "-n", "1", name], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch {
    commit = "";
  }
  if (!commit) {
    return { name, exists: false, atHead: false, commit: null };
  }
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  return {
    name,
    exists: true,
    atHead: commit === head,
    commit
  };
}
function publishPlan(packages, registry) {
  return packages.map((pkg) => ({
    pkg,
    registries: Object.fromEntries(
      destinations(registry).map((destination) => [
        destination,
        packageRegistryState(pkg, destination)
      ])
    )
  }));
}
function printPlan(plan) {
  console.log("\nPublish plan:");
  for (const { pkg, registries } of plan) {
    console.log(`${pkg.manifest.name}@${pkg.manifest.version}`);
    for (const [registry, state] of Object.entries(registries)) {
      console.log(`  ${registry}  ${state}`);
    }
  }
}
function serializePublishPlan(plan, { registry, tag, access }) {
  return {
    registry,
    tag,
    access,
    packages: plan.map(({ pkg, registries }) => ({
      name: pkg.manifest.name,
      version: pkg.manifest.version,
      directory: pkg.directory,
      releaseIdentity: releaseIdentity(pkg),
      registries,
      publishable: Object.values(registries).includes("missing")
    }))
  };
}
function parsePackResult(raw, pkg, artifactDirectory) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Unable to parse npm pack output for ${pkg.manifest.name}.`
    );
  }
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error(
      `Expected one packed artifact for ${pkg.manifest.name}, received ${Array.isArray(parsed) ? parsed.length : "invalid output"}.`
    );
  }
  const item = parsed[0];
  const filename = typeof item.filename === "string" ? item.filename : "";
  const name = typeof item.name === "string" ? item.name : "";
  const version = typeof item.version === "string" ? item.version : "";
  if (!filename || name !== pkg.manifest.name || version !== pkg.manifest.version) {
    throw new Error(
      `Packed artifact identity mismatch for ${pkg.manifest.name}@${pkg.manifest.version}.`
    );
  }
  if (pkg.manifest.files?.includes("dist")) {
    const packedFiles = Array.isArray(item.files) ? item.files.map(
      (file) => typeof file === "object" && file !== null && "path" in file && typeof file.path === "string" ? file.path : null
    ).filter((path) => Boolean(path)) : [];
    if (!packedFiles.some((path) => path === "dist" || path.startsWith("dist/"))) {
      throw new Error(
        `Packed artifact for ${pkg.manifest.name}@${pkg.manifest.version} does not contain dist output.`
      );
    }
  }
  return {
    path: resolve(artifactDirectory, filename),
    filename,
    name,
    version,
    size: typeof item.size === "number" ? item.size : null,
    integrity: typeof item.integrity === "string" ? item.integrity : null,
    shasum: typeof item.shasum === "string" ? item.shasum : null
  };
}
function validateAndPack(root, pkg, artifactDirectory, { quiet = false } = {}) {
  if (!quiet) {
    console.log(
      `
Validating ${pkg.manifest.name}@${pkg.manifest.version} (${pkg.directory})`
    );
  }
  const dependencies = dependencyCheck(root, pkg);
  if (!quiet) printDependencyCheck(dependencies);
  assertDependencies(dependencies);
  for (const script of ["typecheck", "test", "build"]) {
    execFileSync(
      "npm",
      ["run", script, "--workspace", pkg.manifest.name, "--if-present"],
      {
        cwd: root,
        stdio: quiet ? ["ignore", "ignore", "inherit"] : "inherit"
      }
    );
  }
  mkdirSync(artifactDirectory, { recursive: true });
  const raw = execFileSync(
    "npm",
    [
      "pack",
      "--workspace",
      pkg.manifest.name,
      "--json",
      "--pack-destination",
      artifactDirectory
    ],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"]
    }
  );
  const artifact = parsePackResult(raw, pkg, artifactDirectory);
  if (!existsSync(artifact.path)) {
    throw new Error(
      `npm pack did not create expected artifact: ${artifact.path}`
    );
  }
  if (!quiet) {
    console.log(`Packed ${artifact.filename}`);
  }
  return artifact;
}
function registryPublishArgs(registry, artifactPath, tag, access) {
  return registry === "npm" ? ["stage", "publish", artifactPath, "--access", access, "--tag", tag] : ["publish", artifactPath, "--access", access, "--tag", tag];
}
function publishOne(root, pkg, artifact, registry, tag, access, { quiet = false } = {}) {
  const config = registryConfig(registry);
  if (!config.token) {
    throw new Error(
      registry === "github" ? "Set _GITHUB_TOKEN before publishing." : "Set _NPM_TOKEN before staging a release."
    );
  }
  const directory = mkdtempSync(join(tmpdir(), "workspace-publish-"));
  const npmrc = join(directory, "npmrc");
  writeFileSync(
    npmrc,
    [
      `registry=${config.url}`,
      `//${config.host}/:_authToken=\${NODE_AUTH_TOKEN}`,
      ""
    ].join("\n")
  );
  const env = {
    ...process.env,
    NODE_AUTH_TOKEN: config.token,
    npm_config_userconfig: npmrc
  };
  try {
    if (registry === "github") {
      execFileSync(
        "npm",
        registryPublishArgs(registry, artifact.path, tag, access),
        {
          cwd: root,
          env,
          stdio: quiet ? ["ignore", "ignore", "inherit"] : "inherit"
        }
      );
      return;
    }
    execFileSync(
      "npm",
      registryPublishArgs(registry, artifact.path, tag, access),
      {
        cwd: root,
        env,
        stdio: quiet ? ["ignore", "ignore", "inherit"] : "inherit"
      }
    );
    if (!quiet) {
      console.log(
        `Staged ${pkg.manifest.name}@${pkg.manifest.version} on npmjs.org. Approve the staged release with 2FA before it becomes public.`
      );
    }
  } finally {
    rmSync(directory, {
      recursive: true,
      force: true
    });
  }
}
function publish({
  selector,
  registry = "github",
  tag = "latest",
  access = "public",
  dryRun = false,
  list = false,
  json = false,
  withDependencies = false,
  verifyGitTag = true,
  artifactDirectory
}) {
  if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(tag)) {
    throw new Error("Invalid npm distribution tag.");
  }
  if (!["public", "restricted"].includes(access)) {
    throw new Error("Access must be public or restricted.");
  }
  if (!["github", "npm", "both"].includes(registry)) {
    throw new Error("Registry must be github, npm, or both.");
  }
  const root = repositoryRoot();
  if (dryRun && !selector) {
    const packages2 = publishablePackages(root);
    if (!packages2.length) {
      throw new Error("No publishable packages were found under packages/*.");
    }
    const plan2 = publishPlan(packages2, registry);
    const gitTags2 = Object.fromEntries(
      packages2.map((item) => [
        item.manifest.name,
        packageGitTagState(root, item)
      ])
    );
    const tagProblems2 = verifyGitTag ? packages2.map((item) => {
      const state = gitTags2[item.manifest.name];
      if (!state.exists) {
        return `Git release tag ${state.name} does not exist.`;
      }
      if (!state.atHead) {
        return `Git release tag ${state.name} points to ${state.commit}, not HEAD.`;
      }
      return null;
    }).filter(Boolean) : [];
    const pendingPackages2 = plan2.filter(({ registries }) => Object.values(registries).includes("missing")).map(({ pkg: item }) => item);
    const ownedArtifactDirectory2 = !artifactDirectory;
    const artifactRoot2 = artifactDirectory ? resolve(root, artifactDirectory) : mkdtempSync(join(tmpdir(), "workspace-publish-artifacts-"));
    const artifacts2 = [];
    try {
      for (const item of pendingPackages2) {
        const artifact = validateAndPack(root, item, artifactRoot2, {
          quiet: json
        });
        artifacts2.push(artifact);
      }
    } finally {
      if (ownedArtifactDirectory2) {
        rmSync(artifactRoot2, { recursive: true, force: true });
      }
    }
    if (!json) {
      console.log(
        `
Publish preview completed for ${packages2.length} package(s). Nothing was published.`
      );
    }
    return {
      operation: "publish",
      status: tagProblems2.length ? "warning" : "preview",
      dryRun: true,
      verifyGitTag,
      gitTags: gitTags2,
      canPublish: tagProblems2.length === 0,
      reason: tagProblems2.length ? tagProblems2.join(" ") : null,
      artifacts: artifacts2.map(({ path: _path, ...artifact }) => artifact),
      ...serializePublishPlan(plan2, { registry, tag, access })
    };
  }
  if (!selector) {
    throw new Error("A package selector is required for publishing.");
  }
  const pkg = packageInfo(root, selector);
  if (pkg.manifest.private) {
    throw new Error(`${pkg.manifest.name} is private and cannot be published.`);
  }
  const packages = withDependencies ? workspacePublishOrder(root, pkg) : [pkg];
  const privateDependency = packages.find((item) => item.manifest.private);
  if (privateDependency) {
    throw new Error(
      `${privateDependency.manifest.name} is private and cannot be published as a dependency.`
    );
  }
  const plan = publishPlan(packages, registry);
  const gitTags = Object.fromEntries(
    packages.map((item) => [
      item.manifest.name,
      packageGitTagState(root, item)
    ])
  );
  const tagProblems = verifyGitTag ? packages.map((item) => {
    const state = gitTags[item.manifest.name];
    if (!state.exists) {
      return `Git release tag ${state.name} does not exist.`;
    }
    if (!state.atHead) {
      return `Git release tag ${state.name} points to ${state.commit}, not HEAD.`;
    }
    return null;
  }).filter(Boolean) : [];
  if (list && !json) {
    printPlan(plan);
  }
  const pendingPackages = plan.filter(({ registries }) => Object.values(registries).includes("missing")).map(({ pkg: item }) => item);
  if (list && !dryRun) {
    return {
      operation: "publish",
      status: "plan",
      dryRun: false,
      verifyGitTag,
      gitTags,
      ...serializePublishPlan(plan, { registry, tag, access })
    };
  }
  if (tagProblems.length && !dryRun) {
    throw new Error(
      `Publish blocked by Git tag verification:
${tagProblems.map((problem) => `- ${problem}`).join("\n")}`
    );
  }
  const ownedArtifactDirectory = !artifactDirectory;
  const artifactRoot = artifactDirectory ? resolve(root, artifactDirectory) : mkdtempSync(join(tmpdir(), "workspace-publish-artifacts-"));
  const artifacts = /* @__PURE__ */ new Map();
  try {
    for (const item of pendingPackages) {
      artifacts.set(
        item.manifest.name,
        validateAndPack(root, item, artifactRoot, { quiet: json })
      );
    }
    if (dryRun) {
      const names = pendingPackages.map((item) => item.manifest.name);
      if (!json) {
        console.log(
          names.length ? `
Release checks passed for ${names.join(", ")}. Nothing was published.` : "\nAll selected package versions are already published. Nothing to validate or publish."
        );
      }
      return {
        operation: "publish",
        status: tagProblems.length ? "warning" : "preview",
        dryRun: true,
        verifyGitTag,
        gitTags,
        canPublish: tagProblems.length === 0,
        reason: tagProblems.length ? tagProblems.join(" ") : null,
        artifacts: [...artifacts.values()].map(
          ({ path: _path, ...artifact }) => artifact
        ),
        ...serializePublishPlan(plan, { registry, tag, access })
      };
    }
    const results = [];
    for (const { pkg: item, registries } of plan) {
      for (const destination of destinations(registry)) {
        if (registries[destination] === "published") {
          if (!json) {
            console.log(
              `Skipping ${item.manifest.name}@${item.manifest.version} on ${destination}: already published.`
            );
          }
          results.push({
            package: item.manifest.name,
            version: item.manifest.version,
            registry: destination,
            status: "skipped",
            reason: "already-published"
          });
          continue;
        }
        const artifact = artifacts.get(item.manifest.name);
        if (!artifact) {
          throw new Error(
            `Missing packed artifact for ${item.manifest.name}@${item.manifest.version}.`
          );
        }
        publishOne(root, item, artifact, destination, tag, access, {
          quiet: json
        });
        results.push({
          package: item.manifest.name,
          version: item.manifest.version,
          registry: destination,
          status: destination === "npm" ? "staged" : "published"
        });
      }
    }
    return {
      operation: "publish",
      status: "success",
      dryRun: false,
      verifyGitTag,
      gitTags,
      registry,
      tag,
      access,
      results,
      artifacts: [...artifacts.values()].map(
        ({ path: _path, ...artifact }) => artifact
      ),
      packages: serializePublishPlan(plan, { registry, tag, access }).packages
    };
  } finally {
    if (ownedArtifactDirectory) {
      rmSync(artifactRoot, { recursive: true, force: true });
    }
  }
}
function publishWorkspacePackage(selector, options) {
  const root = repositoryRoot();
  const selectedPackage = selector ?? (options.dryRun ? void 0 : selectPackageWithFzf(root));
  if (!selectedPackage && !options.dryRun) {
    console.log("Package selection cancelled.");
    return;
  }
  const result = publish({
    selector: selectedPackage,
    registry: options.registry,
    tag: options.tag,
    access: options.access,
    dryRun: options.dryRun,
    list: options.list,
    json: options.json,
    withDependencies: options.withDependencies,
    verifyGitTag: options.verifyGitTag,
    artifactDirectory: options.artifactDirectory
  });
  if (options.json && result) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}
`);
  }
  return result;
}
function runCliCommand(selector, options) {
  publishWorkspacePackage(selector, options);
}
program.name("workspace-publish").description("Validate and publish workspace packages.").addArgument(
  new Argument("[package]", "Package name, directory, or workspace selector")
).addOption(
  new Option("-r, --registry <registry>", "Registry to publish to").choices(["github", "npm", "both"]).default("github")
).addOption(
  new Option("-t, --tag <tag>", "npm distribution tag").default("latest")
).addOption(
  new Option("-a, --access <access>", "Package access level").choices(["public", "restricted"]).default("public")
).option("-d, --dry-run", "Run release checks without publishing").option("-l, --list", "Print the publish plan without publishing").option("-j, --json", "Print the operation result as JSON").option(
  "--artifact-directory <directory>",
  "Keep generated package tarballs in this directory"
).option(
  "-w, --with-dependencies",
  "Include publishable workspace dependencies"
).option(
  "--no-verify-git-tag",
  "Allow publishing without verifying the matching package release Git tag"
).action(runCliCommand);
await program.parseAsync();

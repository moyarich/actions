#!/usr/bin/env node
import { program, Argument } from "commander";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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
function dependencyStatus(results) {
  if (results.some((item) => item.level === "fail")) {
    return "fail";
  }
  if (results.length) {
    return "warn";
  }
  return "ok";
}
function packageReport(pkg, results) {
  return {
    package: pkg.manifest.name,
    version: pkg.manifest.version,
    status: dependencyStatus(results),
    results
  };
}
function commandExists(command) {
  const lookupCommand = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(lookupCommand, [command], {
    stdio: "ignore"
  });
  return result.status === 0;
}
function isInteractiveTerminal() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
function canUseFzf(options = {}) {
  return Boolean(
    options.fzf !== false && isInteractiveTerminal() && commandExists("fzf")
  );
}
function selectWithFzf(choices, prompt) {
  if (!choices.length) {
    return void 0;
  }
  if (!isInteractiveTerminal()) {
    throw new Error("Interactive selection requires a TTY.");
  }
  if (!commandExists("fzf")) {
    throw new Error("fzf is not available on PATH.");
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
function dependencyCheckPackages(root) {
  const packagesDirectory = resolve(root, "packages");
  if (!existsSync(packagesDirectory)) {
    return [];
  }
  return readdirSync(packagesDirectory, {
    withFileTypes: true
  }).filter(
    (entry) => entry.isDirectory() && existsSync(resolve(packagesDirectory, entry.name, "package.json"))
  ).map((entry) => packageInfo(root, entry.name)).sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}
function selectPackageWithFzf(root) {
  const packages = dependencyCheckPackages(root);
  if (!packages.length) {
    throw new Error("No workspace packages were found under packages/*.");
  }
  return selectWithFzf(
    packages.map((pkg) => pkg.manifest.name),
    "Package"
  );
}
function selectOutputFormatWithFzf() {
  return (
    /** @type {OutputFormat | undefined} */
    selectWithFzf(
      ["text", "json"],
      "Output"
    )
  );
}
function inspectPackage(root, selector) {
  const pkg = packageInfo(root, selector);
  return {
    pkg,
    results: dependencyCheck(root, pkg)
  };
}
function printPackageReport(report, format) {
  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (report.results.length) {
    console.log(`
${report.package}@${report.version}`);
    printDependencyCheck(report.results);
    return;
  }
  console.log(
    `${report.package}@${report.version}: dependencies are up to date.`
  );
}
function checkPackage(root, selector, format, options) {
  const { pkg, results } = inspectPackage(root, selector);
  const report = packageReport(pkg, results);
  printPackageReport(report, format);
  if (options.assert !== false) {
    assertDependencies(results);
  }
  return report;
}
function checkAllPackages(root, format, options) {
  const packages = dependencyCheckPackages(root);
  if (!packages.length) {
    throw new Error("No workspace packages were found under packages/*.");
  }
  const reports = packages.map((pkg) => {
    const results = dependencyCheck(root, pkg);
    return packageReport(pkg, results);
  });
  if (format === "json") {
    const status = reports.some((item) => item.status === "fail") ? "fail" : reports.some((item) => item.status === "warn") ? "warn" : "ok";
    console.log(
      JSON.stringify(
        {
          status,
          packages: reports
        },
        null,
        2
      )
    );
  } else {
    for (const report of reports) {
      console.log(`
Checking ${report.package}@${report.version}...`);
      if (report.results.length) {
        printDependencyCheck(report.results);
      } else {
        console.log("  Dependencies are up to date.");
      }
    }
  }
  if (options.assert !== false) {
    for (const report of reports) {
      assertDependencies(report.results);
    }
  }
  return reports;
}
function resolvePackageSelector(root, selector, options) {
  if (selector) {
    return selector;
  }
  if (canUseFzf(options)) {
    return selectPackageWithFzf(root);
  }
  return void 0;
}
function resolveOutputFormat(options) {
  if (options.json) {
    return "json";
  }
  if (canUseFzf(options)) {
    return selectOutputFormatWithFzf();
  }
  return "text";
}
function runDependencyCheck(selector, options) {
  const root = repositoryRoot();
  const format = resolveOutputFormat(options);
  if (!format) {
    console.log("Output selection cancelled.");
    return;
  }
  if (options.all) {
    checkAllPackages(root, format, options);
    return;
  }
  if (options.json && !selector) {
    checkAllPackages(root, "json", options);
    return;
  }
  const selectedPackage = resolvePackageSelector(root, selector, options);
  if (!selectedPackage) {
    if (canUseFzf(options)) {
      console.log("Package selection cancelled.");
      return;
    }
    throw new Error(
      [
        "A package selector is required in non-interactive mode.",
        "",
        "Examples:",
        "  workspace-dependency-check workspace-tools",
        "  workspace-dependency-check --all",
        "  workspace-dependency-check --json"
      ].join("\n")
    );
  }
  checkPackage(root, selectedPackage, format, options);
}
program.name("workspace-dependency-check").description(
  "Check workspace dependencies for outdated versions and internal version mismatches."
).addArgument(
  new Argument("[package]", "Package name, directory, or workspace selector")
).option("-a, --all", "Check every workspace package").option("-j, --json", "Output dependency check results as JSON").option(
  "-n, --no-assert",
  "Report dependency failures without exiting with an error"
).option("--no-fzf", "Disable automatic fzf selection").action(runDependencyCheck);
await program.parseAsync();

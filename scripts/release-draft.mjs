#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

/**
 * @typedef {object} ReleaseDraftConfigOptions
 * @property {string} outputPath Path where the generated Release Drafter config is written.
 * @property {string} targetPath Optional repository path that scopes PRs to one package or application.
 * @property {string} tagPrefix Prefix used to match this target's published releases.
 * @property {string} releaseNameTemplate Release name template containing the resolved-version variable.
 * @property {string} tagTemplate Release tag template containing the resolved-version variable.
 */

/**
 * @typedef {object} ReconcileOptions
 * @property {string} existingBody Existing GitHub Release draft body.
 * @property {string} generatedBody Release Drafter output for the active release window.
 * @property {string} changelogPath Changelog path used only when a draft must be seeded.
 * @property {string} version Version being drafted.
 * @property {string} targetKey Stable identifier for the release target.
 * @property {string} seedSha Commit SHA that establishes the initial draft baseline.
 * @property {string} targetPath Optional path used to scope commit-history fallback.
 */

/**
 * @typedef {"changelog" | "release-drafter" | "commits" | "minimal"} SeedSource
 */

/**
 * @typedef {object} SeedResult
 * @property {SeedSource} source Source selected for a newly created draft.
 * @property {string} body Initial public release-note content.
 */

const GENERATED_START = "<!-- moya-release:generated:start -->";
const GENERATED_END = "<!-- moya-release:generated:end -->";

/**
 * Parse command-line options in --name value form.
 *
 * @param {string[]} argv CLI arguments.
 * @returns {Map<string, string>} Parsed options.
 */
function parseArgs(argv) {
  const args = new Map();

  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1] ?? "";

    if (!name?.startsWith("--")) {
      throw new Error(
        "Expected an option beginning with --, received: " +
          (name ?? "<missing>"),
      );
    }

    args.set(name.slice(2), value);
  }

  return args;
}

/**
 * Quote a scalar so arbitrary caller input is safe in generated YAML.
 *
 * @param {string} value Scalar value.
 * @returns {string} YAML-safe quoted scalar.
 */
function yamlString(value) {
  return JSON.stringify(value);
}

/**
 * Render the Release Drafter configuration used by the persistent draft workflow.
 *
 * Release Drafter remains responsible for PR discovery, categorization, path
 * filtering, and semantic-version resolution. It always runs in dry-run mode;
 * the reusable workflow owns the persistent GitHub Release body.
 *
 * @param {ReleaseDraftConfigOptions} options Config generation options.
 * @returns {string} Release Drafter YAML.
 */
function renderReleaseDrafterConfig(options) {
  const targetPath = options.targetPath.replace(/\/$/, "");
  const includePaths = targetPath
    ? "\ninclude-paths:\n  - " + yamlString(targetPath + "/**") + "\n"
    : "";

  return [
    "name-template: " + yamlString(options.releaseNameTemplate),
    "tag-template: " + yamlString(options.tagTemplate),
    "tag-prefix: " + yamlString(options.tagPrefix),
    includePaths.trimEnd(),
    "categories:",
    "  - type: pre-exclude",
    "    when:",
    "      labels:",
    "        - skip-changelog",
    "        - skip-release",
    "        - documentation",
    "        - docs",
    "        - test",
    "        - tests",
    "        - coverage",
    "        - ci",
    "        - chore",
    "        - maintenance",
    "        - build",
    "        - release",
    "",
    "  - type: pre-exclude",
    "    when:",
    "      title:",
    "        - '/^(docs|chore|ci|test|build|style|refactor)(\\([^)]*\\))?!?:\\s*/i'",
    "",
    '  - title: "Breaking changes"',
    "    semver-increment: major",
    "    when:",
    "      labels:",
    "        - breaking",
    "        - major",
    "",
    '  - title: "Features"',
    "    semver-increment: minor",
    "    when:",
    "      labels:",
    "        - feature",
    "        - enhancement",
    "",
    '  - title: "Bug fixes"',
    "    semver-increment: patch",
    "    when:",
    "      labels:",
    "        - bug",
    "        - bugfix",
    "        - fix",
    "",
    '  - title: "Performance"',
    "    semver-increment: patch",
    "    when:",
    "      labels:",
    "        - performance",
    "        - perf",
    "",
    '  - title: "Compatibility"',
    "    semver-increment: patch",
    "    when:",
    "      labels:",
    "        - compatibility",
    "",
    "  - type: version-resolver",
    "    semver-increment: patch",
    "",
    'change-template: "- $TITLE (#$NUMBER) @$AUTHOR <!-- moya-release:pr=$NUMBER -->"',
    "change-title-escapes: '\\\\<*_&'",
    'no-changes-template: ""',
    "template: |",
    "  $CHANGES",
    "",
  ]
    .filter(
      (line, index, lines) =>
        !(line === "" && index > 0 && lines[index - 1] === ""),
    )
    .join("\n");
}

/**
 * Extract a version-specific section from a Markdown changelog.
 *
 * Recognized headings include version headings with optional square brackets
 * and an optional suffix beginning with a hyphen.
 *
 * @param {string} markdown Complete changelog text.
 * @param {string} version Release version.
 * @returns {string} Matching section body, or an empty string.
 */
function changelogSection(markdown, version) {
  if (!version) {
    return "";
  }

  const escaped = version.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(
    "^##\\s+\\[?" + escaped + "\\]?(?:\\s+-\\s+.+)?\\s*$",
  );

  const notes = [];
  let collecting = false;

  for (const line of markdown.split("\n")) {
    if (!collecting && heading.test(line.trim())) {
      collecting = true;
      continue;
    }

    if (collecting && /^##\s+/.test(line)) {
      break;
    }

    if (collecting) {
      notes.push(line);
    }
  }

  return notes.join("\n").trim();
}

/**
 * Normalize Release Drafter output before it is merged into the managed region.
 *
 * @param {string} body Release Drafter body.
 * @returns {string} Trimmed generated content.
 */
function normalizeGeneratedBody(body) {
  return body.trim();
}

/**
 * Determine whether Release Drafter produced meaningful public changes.
 *
 * @param {string} body Generated body.
 * @returns {boolean} Whether useful release-note content exists.
 */
function hasMeaningfulGeneratedBody(body) {
  return (
    body
      .replace(/[*-]\s*No changes\.?/gi, "")
      .replace(/#+\s*(Changes|Release notes|What's Changed)/gi, "")
      .trim().length > 0
  );
}

/**
 * Build a public-facing fallback from Git commit history.
 *
 * Conventional maintenance-only commit types are excluded. Untyped legacy
 * commits remain eligible so old repositories can adopt the workflow without
 * rewriting historical commits.
 *
 * @param {string} targetPath Optional monorepo path scope.
 * @returns {string} Markdown list of historical changes.
 */
function commitFallback(targetPath) {
  const args = ["log", "--reverse", "--format=%s%x09%h", "HEAD"];

  if (targetPath) {
    args.push("--", targetPath);
  }

  const output = execFileSync("git", args, { encoding: "utf8" }).trim();

  if (!output) {
    return "";
  }

  const excludedTypes = new Set([
    "docs",
    "build",
    "ci",
    "test",
    "style",
    "chore",
    "refactor",
  ]);
  const seen = new Set();
  const entries = [];

  for (const row of output.split("\n")) {
    const [rawSubject, hash = ""] = row.split("\t", 2);
    const subject = rawSubject?.trim();

    if (!subject || /^release(?:\([^)]*\))?:/i.test(subject)) {
      continue;
    }

    const match = subject.match(
      /^(feat|fix|perf|refactor|docs|build|ci|test|style|chore)(?:\([^)]*\))?!?:\s*(.+)$/i,
    );

    const type = match?.[1]?.toLowerCase() ?? "";
    const summary = (match?.[2] ?? subject).replace(/\s*\(#\d+\)$/, "").trim();

    if (!summary || excludedTypes.has(type)) {
      continue;
    }

    const key = summary.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    entries.push(hash ? "- " + summary + " (" + hash + ")" : "- " + summary);
  }

  return entries.join("\n");
}

/**
 * Split the automation-owned Release Drafter region from a persistent body.
 *
 * @param {string} body Existing release body.
 * @returns {{before: string, generated: string, after: string} | null} Region parts.
 */
function splitGeneratedRegion(body) {
  const start = body.indexOf(GENERATED_START);
  const end = body.indexOf(GENERATED_END);

  if (start < 0 || end < 0 || end < start) {
    return null;
  }

  return {
    before: body.slice(0, start).trimEnd(),
    generated: body.slice(start + GENERATED_START.length, end).trim(),
    after: body.slice(end + GENERATED_END.length).trimStart(),
  };
}

/**
 * Read PR markers already present in a release body.
 *
 * @param {string} body Markdown body.
 * @returns {Set<string>} PR numbers represented by hidden markers.
 */
function pullRequestMarkers(body) {
  const markers = new Set();

  for (const match of body.matchAll(/<!--\s*moya-release:pr=(\d+)\s*-->/g)) {
    markers.add(match[1]);
  }

  return markers;
}

/**
 * Parse Release Drafter output into category entries.
 *
 * @param {string} body Release Drafter generated body.
 * @returns {Map<string, string[]>} Entries grouped by category.
 */
function generatedEntries(body) {
  const groups = new Map();
  let category = "Changes";

  for (const line of normalizeGeneratedBody(body).split("\n")) {
    const heading = line.match(/^###\s+(.+?)\s*$/);

    if (heading) {
      category = heading[1];
      continue;
    }

    if (/^\s*[-*]\s+.+<!--\s*moya-release:pr=\d+\s*-->\s*$/.test(line)) {
      if (!groups.has(category)) {
        groups.set(category, []);
      }

      groups.get(category).push(line.trim());
    }
  }

  return groups;
}

/**
 * Append missing entries to one Markdown category without deleting existing text.
 *
 * @param {string} markdown Existing generated-region Markdown.
 * @param {string} category Category title.
 * @param {string[]} entries Missing entries to append.
 * @returns {string} Updated Markdown.
 */
function appendCategoryEntries(markdown, category, entries) {
  if (!entries.length) {
    return markdown;
  }

  const source = markdown.trim();
  const heading = "### " + category;

  if (!source) {
    return heading + "\n\n" + entries.join("\n");
  }

  const lines = source.split("\n");
  const headingIndex = lines.findIndex((line) => line.trim() === heading);

  if (headingIndex < 0) {
    return source + "\n\n" + heading + "\n\n" + entries.join("\n");
  }

  let insertAt = lines.length;

  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^###\s+/.test(lines[index])) {
      insertAt = index;
      break;
    }
  }

  const prefix = lines.slice(0, insertAt);

  while (prefix.length && prefix.at(-1) === "") {
    prefix.pop();
  }

  return [...prefix, ...entries, "", ...lines.slice(insertAt)]
    .join("\n")
    .trim();
}

/**
 * Merge new Release Drafter PR entries into an existing generated region.
 *
 * The merge is append-only: existing generated text is never removed or
 * rewritten. PR markers make reruns idempotent.
 *
 * @param {string} existingGenerated Existing automation-managed Markdown.
 * @param {string} latestGenerated Current Release Drafter output.
 * @returns {string} Append-only merged generated Markdown.
 */
function mergeGeneratedEntries(existingGenerated, latestGenerated) {
  let merged = existingGenerated.trim();
  const seen = pullRequestMarkers(merged);

  for (const [category, entries] of generatedEntries(latestGenerated)) {
    const missing = entries.filter((entry) => {
      const match = entry.match(/moya-release:pr=(\d+)/);
      return match && !seen.has(match[1]);
    });

    for (const entry of missing) {
      const match = entry.match(/moya-release:pr=(\d+)/);

      if (match) {
        seen.add(match[1]);
      }
    }

    merged = appendCategoryEntries(merged, category, missing);
  }

  return merged;
}

/**
 * Render a generated region with stable boundary markers.
 *
 * @param {string} body Managed Markdown.
 * @returns {string} Marker-wrapped region.
 */
function generatedRegion(body) {
  return [GENERATED_START, body.trim(), GENERATED_END]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Ensure the release body contains persistent target and seed metadata.
 *
 * @param {string} body Release body.
 * @param {string} targetKey Stable target identifier.
 * @param {string} seedSha Initial draft baseline SHA.
 * @param {SeedSource | "existing"} source Initial source.
 * @returns {string} Body with metadata markers.
 */
function ensureMetadata(body, targetKey, seedSha, source) {
  let result = body.trim();

  if (!/<!--\s*moya-release:target=/.test(result)) {
    result = "<!-- moya-release:target=" + targetKey + " -->\n" + result;
  }

  if (seedSha && !/<!--\s*moya-release:seed-sha=/.test(result)) {
    result = result.replace(
      /^(<!--\s*moya-release:target=.*?-->)/,
      "$1\n<!-- moya-release:seed-sha=" +
        seedSha +
        " source=" +
        source +
        " -->",
    );
  }

  return result.trim();
}

/**
 * Select the initial body for a release target with no existing draft.
 *
 * Precedence is changelog, Release Drafter PR history, commit history, then a
 * minimal initial-release description.
 *
 * @param {ReconcileOptions} options Reconciliation options.
 * @returns {SeedResult} Selected source and initial content.
 */
function resolveInitialSeed(options) {
  if (options.changelogPath && existsSync(options.changelogPath)) {
    const changelog = readFileSync(options.changelogPath, "utf8");
    const notes = changelogSection(changelog, options.version);

    if (notes) {
      return { source: "changelog", body: notes };
    }
  }

  const generated = normalizeGeneratedBody(options.generatedBody);

  if (hasMeaningfulGeneratedBody(generated)) {
    return {
      source: "release-drafter",
      body: generatedRegion(generated),
    };
  }

  const commits = commitFallback(options.targetPath);

  if (commits) {
    return {
      source: "commits",
      body: "## Release notes\n\n" + commits,
    };
  }

  return {
    source: "minimal",
    body: "## Release notes\n\nInitial release.",
  };
}

/**
 * Reconcile a persistent GitHub Release body.
 *
 * Existing bodies are preserved. Release Drafter may only append previously
 * unseen PR entries inside the bounded generated region.
 *
 * @param {ReconcileOptions} options Reconciliation options.
 * @returns {string} Complete reconciled body.
 */
function reconcileReleaseBody(options) {
  const existing = options.existingBody.trim();
  const generated = normalizeGeneratedBody(options.generatedBody);

  if (!existing) {
    const seed = resolveInitialSeed(options);

    return ensureMetadata(
      seed.body,
      options.targetKey,
      options.seedSha,
      seed.source,
    );
  }

  let body = existing;
  const split = splitGeneratedRegion(body);

  if (hasMeaningfulGeneratedBody(generated)) {
    if (split) {
      const mergedGenerated = mergeGeneratedEntries(split.generated, generated);

      body = [split.before, generatedRegion(mergedGenerated), split.after]
        .filter(Boolean)
        .join("\n\n");
    } else {
      const existingMarkers = pullRequestMarkers(body);
      let managed = "";

      for (const [category, entries] of generatedEntries(generated)) {
        const missing = entries.filter((entry) => {
          const match = entry.match(/moya-release:pr=(\d+)/);
          return match && !existingMarkers.has(match[1]);
        });

        managed = appendCategoryEntries(managed, category, missing);
      }

      if (managed) {
        body = body.trim() + "\n\n" + generatedRegion(managed);
      }
    }
  }

  return ensureMetadata(body, options.targetKey, options.seedSha, "existing");
}

/**
 * Run deterministic checks for append-only reconciliation.
 *
 * @returns {void}
 */
function selfTest() {
  const seeded = reconcileReleaseBody({
    existingBody: "",
    generatedBody:
      "### Features\n\n- New feature (#12) @dev <!-- moya-release:pr=12 -->",
    changelogPath: "/path/that/does/not/exist",
    version: "0.1.0",
    targetKey: "root",
    seedSha: "abc123",
    targetPath: "",
  });

  assert.match(seeded, /moya-release:pr=12/);
  assert.match(seeded, /moya-release:seed-sha=abc123/);

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

  const merged = reconcileReleaseBody({
    existingBody: existing,
    generatedBody: [
      "### Features",
      "",
      "- Existing (#12) @dev <!-- moya-release:pr=12 -->",
      "- Added later (#13) @dev <!-- moya-release:pr=13 -->",
    ].join("\n"),
    changelogPath: "",
    version: "0.1.0",
    targetKey: "root",
    seedSha: "def456",
    targetPath: "",
  });

  assert.match(merged, /Reviewer introduction\./);
  assert.match(merged, /Manual footer\./);
  assert.equal((merged.match(/moya-release:pr=12/g) ?? []).length, 1);
  assert.equal((merged.match(/moya-release:pr=13/g) ?? []).length, 1);
}

const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

if (command === "config") {
  const outputPath = args.get("output");

  if (!outputPath) {
    throw new Error("--output is required.");
  }

  writeFileSync(
    outputPath,
    renderReleaseDrafterConfig({
      outputPath,
      targetPath: args.get("target-path") ?? "",
      tagPrefix: args.get("tag-prefix") ?? "v",
      releaseNameTemplate:
        args.get("release-name-template") ?? "v$RESOLVED_VERSION",
      tagTemplate: args.get("tag-template") ?? "v$RESOLVED_VERSION",
    }),
  );
} else if (command === "reconcile") {
  const existingFile = args.get("existing-file");
  const generatedFile = args.get("generated-file");
  const outputFile = args.get("output");

  if (!existingFile || !generatedFile || !outputFile) {
    throw new Error(
      "--existing-file, --generated-file, and --output are required.",
    );
  }

  const result = reconcileReleaseBody({
    existingBody: existsSync(existingFile)
      ? readFileSync(existingFile, "utf8")
      : "",
    generatedBody: existsSync(generatedFile)
      ? readFileSync(generatedFile, "utf8")
      : "",
    changelogPath: args.get("changelog") ?? "CHANGELOG.md",
    version: args.get("version") ?? "",
    targetKey: args.get("target-key") ?? "root",
    seedSha: args.get("seed-sha") ?? "",
    targetPath: args.get("target-path") ?? "",
  });

  writeFileSync(outputFile, result.trim() + "\n");
} else if (command === "self-test") {
  selfTest();
  process.stdout.write("release-draft self-test passed\n");
} else {
  throw new Error(
    "Usage: release-draft.mjs <config|reconcile|self-test> [options]",
  );
}

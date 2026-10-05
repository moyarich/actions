import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import process from "node:process";

type SeedSource = "changelog" | "release-drafter" | "commits" | "minimal";

type ReconcileOptions = {
  existingBody: string;
  generatedBody: string;
  changelogPath: string;
  version: string;
  targetKey: string;
  seedSha: string;
  targetPath: string;
};

type SeedResult = {
  source: SeedSource;
  body: string;
};

const GENERATED_START = "<!-- moya-release:generated:start -->";
const GENERATED_END = "<!-- moya-release:generated:end -->";

function input(name: string, required = false): string {
  const suffix = name.toUpperCase();
  const value =
    process.env[`INPUT_${suffix}`] ??
    process.env[`INPUT_${suffix.replaceAll("-", "_")}`] ??
    "";

  if (required && !value) {
    throw new Error(`Missing required input: ${name}`);
  }

  return value;
}

function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) appendFileSync(outputFile, `${name}=${value}\n`);
}

function changelogSection(markdown: string, version: string): string {
  if (!version) return "";

  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(
    "^##\\s+\\[?" + escaped + "\\]?(?:\\s+-\\s+.+)?\\s*$",
  );

  const notes: string[] = [];
  let collecting = false;

  for (const line of markdown.split("\n")) {
    if (!collecting && heading.test(line.trim())) {
      collecting = true;
      continue;
    }
    if (collecting && /^##\s+/.test(line)) break;
    if (collecting) notes.push(line);
  }

  return notes.join("\n").trim();
}

function normalizeGeneratedBody(body: string): string {
  return body.trim();
}

function hasMeaningfulGeneratedBody(body: string): boolean {
  return (
    body
      .replace(/[*-]\s*No changes\.?/gi, "")
      .replace(/#+\s*(Changes|Release notes|What's Changed)/gi, "")
      .trim().length > 0
  );
}

function commitFallback(targetPath: string): string {
  const args = ["log", "--reverse", "--format=%s%x09%h", "HEAD"];
  if (targetPath && targetPath !== ".") args.push("--", targetPath);

  const output = execFileSync("git", args, { encoding: "utf8" }).trim();
  if (!output) return "";

  const excludedTypes = new Set([
    "docs",
    "build",
    "ci",
    "test",
    "style",
    "chore",
    "refactor",
  ]);
  const seen = new Set<string>();
  const entries: string[] = [];

  for (const row of output.split("\n")) {
    const [rawSubject, hash = ""] = row.split("\t", 2);
    const subject = rawSubject?.trim();

    if (!subject || /^release(?:\([^)]*\))?:/i.test(subject)) continue;

    const match = subject.match(
      /^(feat|fix|perf|refactor|docs|build|ci|test|style|chore)(?:\([^)]*\))?!?:\s*(.+)$/i,
    );

    const type = match?.[1]?.toLowerCase() ?? "";
    const summary = (match?.[2] ?? subject).replace(/\s*\(#\d+\)$/, "").trim();

    if (!summary || excludedTypes.has(type)) continue;

    const key = summary.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    entries.push(hash ? `- ${summary} (${hash})` : `- ${summary}`);
  }

  return entries.join("\n");
}

function splitGeneratedRegion(body: string) {
  const start = body.indexOf(GENERATED_START);
  const end = body.indexOf(GENERATED_END);

  if (start < 0 || end < 0 || end < start) return null;

  return {
    before: body.slice(0, start).trimEnd(),
    generated: body.slice(start + GENERATED_START.length, end).trim(),
    after: body.slice(end + GENERATED_END.length).trimStart(),
  };
}

function pullRequestMarkers(body: string): Set<string> {
  const markers = new Set<string>();

  for (const match of body.matchAll(/<!--\s*moya-release:pr=(\d+)\s*-->/g)) {
    markers.add(match[1]);
  }

  return markers;
}

function generatedEntries(body: string): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  let category = "Changes";

  for (const line of normalizeGeneratedBody(body).split("\n")) {
    const heading = line.match(/^###\s+(.+?)\s*$/);

    if (heading) {
      category = heading[1];
      continue;
    }

    if (/^\s*[-*]\s+.+<!--\s*moya-release:pr=\d+\s*-->\s*$/.test(line)) {
      const entries = groups.get(category) ?? [];
      entries.push(line.trim());
      groups.set(category, entries);
    }
  }

  return groups;
}

function appendCategoryEntries(
  markdown: string,
  category: string,
  entries: string[],
): string {
  if (!entries.length) return markdown;

  const source = markdown.trim();
  const heading = `### ${category}`;

  if (!source) return `${heading}\n\n${entries.join("\n")}`;

  const lines = source.split("\n");
  const headingIndex = lines.findIndex((line) => line.trim() === heading);

  if (headingIndex < 0) {
    return `${source}\n\n${heading}\n\n${entries.join("\n")}`;
  }

  let insertAt = lines.length;

  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^###\s+/.test(lines[index])) {
      insertAt = index;
      break;
    }
  }

  const prefix = lines.slice(0, insertAt);
  while (prefix.length && prefix.at(-1) === "") prefix.pop();

  return [...prefix, ...entries, "", ...lines.slice(insertAt)]
    .join("\n")
    .trim();
}

function mergeGeneratedEntries(
  existingGenerated: string,
  latestGenerated: string,
): string {
  let merged = existingGenerated.trim();
  const seen = pullRequestMarkers(merged);

  for (const [category, entries] of generatedEntries(latestGenerated)) {
    const missing = entries.filter((entry) => {
      const match = entry.match(/moya-release:pr=(\d+)/);
      return match && !seen.has(match[1]);
    });

    for (const entry of missing) {
      const match = entry.match(/moya-release:pr=(\d+)/);
      if (match) seen.add(match[1]);
    }

    merged = appendCategoryEntries(merged, category, missing);
  }

  return merged;
}

function generatedRegion(body: string): string {
  return [GENERATED_START, body.trim(), GENERATED_END]
    .filter(Boolean)
    .join("\n\n");
}

function ensureMetadata(
  body: string,
  targetKey: string,
  seedSha: string,
  source: SeedSource | "existing",
): string {
  let result = body.trim();

  if (!/<!--\s*moya-release:target=/.test(result)) {
    result = `<!-- moya-release:target=${targetKey} -->\n${result}`;
  }

  if (seedSha && !/<!--\s*moya-release:seed-sha=/.test(result)) {
    result = result.replace(
      /^(<!--\s*moya-release:target=.*?-->)/,
      `$1\n<!-- moya-release:seed-sha=${seedSha} source=${source} -->`,
    );
  }

  return result.trim();
}

function resolveInitialSeed(options: ReconcileOptions): SeedResult {
  if (options.changelogPath && existsSync(options.changelogPath)) {
    const changelog = readFileSync(options.changelogPath, "utf8");
    const notes = changelogSection(changelog, options.version);
    if (notes) return { source: "changelog", body: notes };
  }

  const generated = normalizeGeneratedBody(options.generatedBody);

  if (hasMeaningfulGeneratedBody(generated)) {
    return { source: "release-drafter", body: generatedRegion(generated) };
  }

  const commits = commitFallback(options.targetPath);

  if (commits) {
    return { source: "commits", body: `## Release notes\n\n${commits}` };
  }

  return { source: "minimal", body: "## Release notes\n\nInitial release." };
}

export function reconcileReleaseBody(options: ReconcileOptions): string {
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

      if (managed) body = `${body.trim()}\n\n${generatedRegion(managed)}`;
    }
  }

  return ensureMetadata(body, options.targetKey, options.seedSha, "existing");
}

export function selfTest(): void {
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

function runAction(): void {
  const existingBodyFile = input("existing-body-file", true);
  const generatedBodyFile = input("generated-body-file", true);
  const outputFile = input("output-file", true);
  const changelogPath = input("changelog-path") || "CHANGELOG.md";
  const version = input("version");
  const targetKey = input("target-key") || "root";
  const seedSha = input("seed-sha");
  const targetPath = input("target-path");

  const result = reconcileReleaseBody({
    existingBody: existsSync(existingBodyFile)
      ? readFileSync(existingBodyFile, "utf8")
      : "",
    generatedBody: existsSync(generatedBodyFile)
      ? readFileSync(generatedBodyFile, "utf8")
      : "",
    changelogPath,
    version,
    targetKey,
    seedSha,
    targetPath,
  });

  writeFileSync(outputFile, `${result.trim()}\n`);
  setOutput("body-file", outputFile);
  setOutput("seed-sha", seedSha);
}

if (process.argv.includes("--self-test")) {
  selfTest();
  process.stdout.write("release-draft-sync self-test passed\n");
} else {
  try {
    runAction();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`release-draft-sync: ${message}\n`);
    process.exitCode = 1;
  }
}

import process from "node:process";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const GENERATED_START = "<!-- release-draft-sync:generated:start -->";
const GENERATED_END = "<!-- release-draft-sync:generated:end -->";
function changelogSection(markdown, version) {
  if (!version) return "";
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(
    "^##\\s+\\[?" + escaped + "\\]?(?:\\s+-\\s+.+)?\\s*$"
  );
  const notes = [];
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
function hasMeaningfulGeneratedBody(body) {
  return body.replace(/[*-]\s*No changes\.?/gi, "").replace(/#+\s*(Changes|Release notes|What's Changed)/gi, "").trim().length > 0;
}
function commitFallback(targetPath) {
  const args = ["log", "--reverse", "--format=%s%x09%h", "HEAD"];
  if (targetPath && targetPath !== ".") {
    args.push("--", targetPath);
  }
  const output = execFileSync("git", args, { encoding: "utf8" }).trim();
  if (!output) return "";
  const excludedTypes = /* @__PURE__ */ new Set([
    "docs",
    "build",
    "ci",
    "test",
    "style",
    "chore",
    "refactor"
  ]);
  const seen = /* @__PURE__ */ new Set();
  const entries = [];
  for (const row of output.split("\n")) {
    const [rawSubject, hash = ""] = row.split("	", 2);
    const subject = rawSubject?.trim();
    if (!subject || /^release(?:\([^)]*\))?:/i.test(subject)) continue;
    const match = subject.match(
      /^(feat|fix|perf|refactor|docs|build|ci|test|style|chore)(?:\([^)]*\))?!?:\s*(.+)$/i
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
function splitGeneratedRegion(body) {
  const start = body.indexOf(GENERATED_START);
  const end = body.indexOf(GENERATED_END);
  if (start < 0 || end < 0 || end < start) return null;
  return {
    before: body.slice(0, start).trimEnd(),
    generated: body.slice(start + GENERATED_START.length, end).trim(),
    after: body.slice(end + GENERATED_END.length).trimStart()
  };
}
function pullRequestMarkers(body) {
  const markers = /* @__PURE__ */ new Set();
  for (const match of body.matchAll(
    /<!--\s*release-draft-sync:pr=(\d+)\s*-->/g
  )) {
    markers.add(match[1]);
  }
  return markers;
}
function generatedEntries(body) {
  const groups = /* @__PURE__ */ new Map();
  let category = "Changes";
  for (const line of body.trim().split("\n")) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      category = heading[1];
      continue;
    }
    if (/^\s*[-*]\s+.+<!--\s*release-draft-sync:pr=\d+\s*-->\s*$/.test(line)) {
      const entries = groups.get(category) ?? [];
      entries.push(line.trim());
      groups.set(category, entries);
    }
  }
  return groups;
}
function appendCategoryEntries(markdown, category, entries) {
  if (!entries.length) return markdown;
  const source = markdown.trim();
  const heading = `### ${category}`;
  if (!source) return `${heading}

${entries.join("\n")}`;
  const lines = source.split("\n");
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex < 0) {
    return `${source}

${heading}

${entries.join("\n")}`;
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
  return [...prefix, ...entries, "", ...lines.slice(insertAt)].join("\n").trim();
}
function mergeGeneratedEntries(existingGenerated, latestGenerated) {
  let merged = existingGenerated.trim();
  const seen = pullRequestMarkers(merged);
  for (const [category, entries] of generatedEntries(latestGenerated)) {
    const missing = entries.filter((entry) => {
      const match = entry.match(/release-draft-sync:pr=(\d+)/);
      return match && !seen.has(match[1]);
    });
    for (const entry of missing) {
      const match = entry.match(/release-draft-sync:pr=(\d+)/);
      if (match) seen.add(match[1]);
    }
    merged = appendCategoryEntries(merged, category, missing);
  }
  return merged;
}
function generatedRegion(body) {
  return [GENERATED_START, body.trim(), GENERATED_END].filter(Boolean).join("\n\n");
}
function ensureMetadata(body, targetKey, seedSha, source) {
  let result = body.trim();
  if (!/<!--\s*release-draft-sync:target=/.test(result)) {
    result = `<!-- release-draft-sync:target=${targetKey} -->
${result}`;
  }
  if (seedSha && !/<!--\s*release-draft-sync:seed-sha=/.test(result)) {
    result = result.replace(
      /^(<!--\s*release-draft-sync:target=.*?-->)/,
      `$1
<!-- release-draft-sync:seed-sha=${seedSha} source=${source} -->`
    );
  }
  return result.trim();
}
function resolveInitialSeed(options) {
  if (options.changelogPath && existsSync(options.changelogPath)) {
    const changelog = readFileSync(options.changelogPath, "utf8");
    const notes = changelogSection(changelog, options.version);
    if (notes) return { source: "changelog", body: notes };
  }
  const generated = options.generatedBody.trim();
  if (hasMeaningfulGeneratedBody(generated)) {
    return { source: "release-drafter", body: generatedRegion(generated) };
  }
  const commits = commitFallback(options.targetPath);
  if (commits) {
    return { source: "commits", body: `## Release notes

${commits}` };
  }
  return { source: "minimal", body: "## Release notes\n\nInitial release." };
}
function reconcileReleaseBody(options) {
  const existing = options.existingBody.trim();
  const generated = options.generatedBody.trim();
  if (!existing) {
    const seed = resolveInitialSeed(options);
    return ensureMetadata(
      seed.body,
      options.targetKey,
      options.seedSha,
      seed.source
    );
  }
  let body = existing;
  const split = splitGeneratedRegion(body);
  if (hasMeaningfulGeneratedBody(generated)) {
    if (split) {
      const mergedGenerated = mergeGeneratedEntries(split.generated, generated);
      body = [split.before, generatedRegion(mergedGenerated), split.after].filter(Boolean).join("\n\n");
    } else {
      const existingMarkers = pullRequestMarkers(body);
      let managed = "";
      for (const [category, entries] of generatedEntries(generated)) {
        const missing = entries.filter((entry) => {
          const match = entry.match(/release-draft-sync:pr=(\d+)/);
          return match && !existingMarkers.has(match[1]);
        });
        managed = appendCategoryEntries(managed, category, missing);
      }
      if (managed) {
        body = `${body.trim()}

${generatedRegion(managed)}`;
      }
    }
  }
  return ensureMetadata(body, options.targetKey, options.seedSha, "existing");
}
function input(name, required = false) {
  const suffix = name.toUpperCase();
  const value = process.env[`INPUT_${suffix}`] ?? process.env[`INPUT_${suffix.replaceAll("-", "_")}`] ?? "";
  if (required && !value) {
    throw new Error(`Missing required input: ${name}`);
  }
  return value;
}
function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}
`);
  }
}
function runAction() {
  const existingBodyFile = input("existing-body-file", true);
  const generatedBodyFile = input("generated-body-file", true);
  const outputFile = input("output-file", true);
  const changelogPath = input("changelog-path") || "CHANGELOG.md";
  const version = input("version");
  const targetKey = input("target-key") || "root";
  const seedSha = input("seed-sha");
  const targetPath = input("target-path");
  const result = reconcileReleaseBody({
    existingBody: existsSync(existingBodyFile) ? readFileSync(existingBodyFile, "utf8") : "",
    generatedBody: existsSync(generatedBodyFile) ? readFileSync(generatedBodyFile, "utf8") : "",
    changelogPath,
    version,
    targetKey,
    seedSha,
    targetPath
  });
  writeFileSync(outputFile, `${result.trim()}
`);
  setOutput("body-file", outputFile);
  setOutput("seed-sha", seedSha);
}
try {
  runAction();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`release-draft-sync: ${message}
`);
  process.exitCode = 1;
}

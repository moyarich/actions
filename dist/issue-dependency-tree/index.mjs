import process$1 from "node:process";
import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
function relation(value) {
  if (Array.isArray(value)) return value;
  return value?.nodes ?? [];
}
function normalizeDependencyNode(value) {
  return {
    number: value.number,
    title: value.title,
    state: value.state,
    url: value.url,
    blockedBy: relation(value.blockedBy),
    blocking: relation(value.blocking)
  };
}
function buildDependencyGraph(values) {
  return Object.fromEntries(
    values.map((value) => {
      const node = normalizeDependencyNode(value);
      return [String(node.number), node];
    })
  );
}
function dependencyNodeNumbers(graph) {
  return Object.values(graph).filter((node) => node.blockedBy.length > 0 || node.blocking.length > 0).map((node) => node.number).sort((a, b) => a - b);
}
function rootNumbers(graph) {
  return Object.values(graph).filter((node) => node.blocking.length > 0 && node.blockedBy.length === 0).map((node) => node.number).sort((a, b) => a - b);
}
function renderNode(graph, number, indent, ancestors, rendered) {
  if (ancestors.has(number)) {
    return [`${indent}- #${number} ⚠ cycle detected`];
  }
  const node = graph[String(number)];
  if (!node) return [`${indent}- #${number} [missing]`];
  rendered.add(number);
  const lines = [`${indent}- #${node.number} — ${node.title} [${node.state}]`];
  const nextAncestors = new Set(ancestors).add(number);
  for (const blocked of node.blocking) {
    lines.push(
      ...renderNode(
        graph,
        blocked.number,
        `  ${indent}`,
        nextAncestors,
        rendered
      )
    );
  }
  return lines;
}
function renderDependencyTree(graph, selectedRoots) {
  const dependencyNumbers = dependencyNodeNumbers(graph);
  if (dependencyNumbers.length === 0) {
    return [
      "# Issue dependency tree",
      "",
      "Top-down: each issue blocks the indented issues below it.",
      "",
      "_No native issue dependencies found._",
      ""
    ].join("\n");
  }
  const roots = rootNumbers(graph);
  const rendered = /* @__PURE__ */ new Set();
  const lines = [
    "# Issue dependency tree",
    "",
    "Top-down: each issue blocks the indented issues below it.",
    ""
  ];
  for (const root of roots) {
    lines.push(...renderNode(graph, root, "", /* @__PURE__ */ new Set(), rendered));
  }
  {
    for (const number of dependencyNumbers) {
      if (rendered.has(number)) continue;
      lines.push("", "## Unrooted dependency chain", "");
      lines.push(...renderNode(graph, number, "", /* @__PURE__ */ new Set(), rendered));
    }
  }
  return `${lines.join("\n")}
`;
}
function dependencyGraphJson(graph) {
  const filtered = Object.fromEntries(
    Object.entries(graph).filter(
      ([, node]) => node.blockedBy.length > 0 || node.blocking.length > 0
    ).map(([key, node]) => [
      key,
      {
        number: node.number,
        title: node.title,
        state: node.state,
        blockedBy: node.blockedBy,
        blocking: node.blocking
      }
    ])
  );
  return JSON.stringify(filtered, null, 2);
}
function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8" });
}
function resolveRepository(explicit) {
  if (explicit) return explicit;
  if (process.env.GH_REPO) return process.env.GH_REPO;
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  return gh([
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner"
  ]).trim();
}
function fetchDependencyGraph(repository) {
  const repo = resolveRepository(repository);
  const issues = JSON.parse(
    gh([
      "issue",
      "list",
      "--repo",
      repo,
      "--state",
      "all",
      "--limit",
      "1000",
      "--json",
      "number"
    ])
  );
  const details = issues.map(
    ({ number }) => JSON.parse(
      gh([
        "issue",
        "view",
        String(number),
        "--repo",
        repo,
        "--json",
        "number,title,state,url,blockedBy,blocking"
      ])
    )
  );
  return buildDependencyGraph(details);
}
function input(name) {
  const suffix = name.toUpperCase();
  return process$1.env[`INPUT_${suffix}`] ?? process$1.env[`INPUT_${suffix.replaceAll("-", "_")}`] ?? "";
}
function setOutput(name, value) {
  const outputFile = process$1.env.GITHUB_OUTPUT;
  if (!outputFile) return;
  const delimiter = `ISSUE_DEPENDENCY_TREE_${name.toUpperCase()}`;
  appendFileSync(outputFile, `${name}<<${delimiter}
${value}
${delimiter}
`);
}
function runAction() {
  const graph = fetchDependencyGraph(input("repo") || void 0);
  const tree = renderDependencyTree(graph);
  const graphJson = dependencyGraphJson(graph);
  if (process$1.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process$1.env.GITHUB_STEP_SUMMARY,
      `${tree}
## Dependency graph JSON

~~~json
${graphJson}
~~~
`
    );
  }
  setOutput("tree", tree);
  setOutput("graph-json", graphJson);
  process$1.stdout.write(tree);
}
try {
  runAction();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process$1.stderr.write(`issue-dependency-tree: ${message}
`);
  process$1.exitCode = 1;
}

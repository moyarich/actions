import process from "node:process";
import { appendFileSync } from "node:fs";
import { f as fetchDependencyGraph, a as renderDependencyTree, d as dependencyGraphJson } from "../assets/github-CADNxngQ.mjs";
import "node:child_process";
function input(name) {
  const suffix = name.toUpperCase();
  return process.env[`INPUT_${suffix}`] ?? process.env[`INPUT_${suffix.replaceAll("-", "_")}`] ?? "";
}
function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
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
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
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
  process.stdout.write(tree);
}
try {
  runAction();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`issue-dependency-tree: ${message}
`);
  process.exitCode = 1;
}

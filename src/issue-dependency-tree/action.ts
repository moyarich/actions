import { appendFileSync } from "node:fs";
import process from "node:process";
import { dependencyGraphJson, renderDependencyTree } from "./issue-dependency-tree";
import { fetchDependencyGraph } from "./github";

function input(name: string): string {
  const suffix = name.toUpperCase();
  return (
    process.env[`INPUT_${suffix}`] ??
    process.env[`INPUT_${suffix.replaceAll("-", "_")}`] ??
    ""
  );
}

function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return;

  const delimiter = `ISSUE_DEPENDENCY_TREE_${name.toUpperCase()}`;
  appendFileSync(outputFile, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

export function runAction(): void {
  const graph = fetchDependencyGraph(input("repo") || undefined);
  const tree = renderDependencyTree(graph);
  const graphJson = dependencyGraphJson(graph);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `${tree}\n## Dependency graph JSON\n\n~~~json\n${graphJson}\n~~~\n`,
    );
  }

  setOutput("tree", tree);
  setOutput("graph-json", graphJson);
  process.stdout.write(tree);
}

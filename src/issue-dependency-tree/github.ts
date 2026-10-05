import { execFileSync } from "node:child_process";
import {
  buildDependencyGraph,
  type DependencyGraph,
} from "./issue-dependency-tree";

function gh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8" });
}

export function resolveRepository(explicit?: string): string {
  if (explicit) return explicit;
  if (process.env.GH_REPO) return process.env.GH_REPO;
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;

  return gh([
    "repo",
    "view",
    "--json",
    "nameWithOwner",
    "--jq",
    ".nameWithOwner",
  ]).trim();
}

export function fetchDependencyGraph(repository?: string): DependencyGraph {
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
      "number",
    ]),
  ) as Array<{ number: number }>;

  const details = issues.map(({ number }) =>
    JSON.parse(
      gh([
        "issue",
        "view",
        String(number),
        "--repo",
        repo,
        "--json",
        "number,title,state,url,blockedBy,blocking",
      ]),
    ),
  );

  return buildDependencyGraph(details);
}

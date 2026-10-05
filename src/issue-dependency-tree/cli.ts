import { spawnSync } from "node:child_process";
import { Command } from "commander";
import {
  dependencyGraphJson,
  dependencyNodeNumbers,
  renderDependencyTree,
  type DependencyGraph,
} from "./core";
import { fetchDependencyGraph, resolveRepository } from "./github";

function selectWithFzf(graph: DependencyGraph): number[] {
  const choices = dependencyNodeNumbers(graph).map((number) => {
    const node = graph[String(number)];
    return `#${number}\t[${node.state}]\t${node.title}`;
  });

  if (choices.length === 0) return [];

  const result = spawnSync(
    "fzf",
    [
      "--multi",
      "--prompt",
      "Issue root> ",
      "--header",
      "Select one or more issue roots (TAB toggles selection)",
    ],
    {
      input: `${choices.join("\n")}\n`,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "inherit"],
    },
  );

  if (
    result.error &&
    (result.error as NodeJS.ErrnoException).code === "ENOENT"
  ) {
    throw new Error(
      "fzf is required for --interactive. Install fzf or run without --interactive.",
    );
  }

  if (result.status === 130 || result.status === 1) return [];
  if (result.status !== 0) {
    throw new Error(`fzf exited with status ${result.status ?? "unknown"}`);
  }

  return result.stdout
    .split("\n")
    .map((line) => line.match(/^#(\d+)/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number);
}

function parseRoots(values: string[]): number[] {
  return values.map((value) => {
    const normalized = value.replace(/^#/, "");
    const number = Number.parseInt(normalized, 10);
    if (!Number.isInteger(number) || number <= 0) {
      throw new Error(`Invalid issue number: ${value}`);
    }
    return number;
  });
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = new Command();

  program
    .name("issue-dependency-tree")
    .description("Render and explore native GitHub issue dependency trees")
    .option("-R, --repo <owner/name>", "GitHub repository")
    .option(
      "-r, --root <issue>",
      "Render from a specific issue root",
      (value, previous: string[]) => [...previous, value],
      [],
    )
    .option(
      "-i, --interactive",
      "Select one or more roots interactively with fzf",
    )
    .option("--json", "Print dependency graph JSON instead of Markdown")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  issue-dependency-tree",
        "  issue-dependency-tree --repo moyarich/actions",
        "  issue-dependency-tree --root 12 --root 18",
        "  issue-dependency-tree --interactive",
        "  issue-dependency-tree --json",
      ].join("\n"),
    )
    .action(
      (options: {
        repo?: string;
        root: string[];
        interactive?: boolean;
        json?: boolean;
      }) => {
        const repo = resolveRepository(options.repo);
        const graph = fetchDependencyGraph(repo);

        if (options.json) {
          process.stdout.write(`${dependencyGraphJson(graph)}\n`);
          return;
        }

        const explicitRoots = parseRoots(options.root);
        const selectedRoots = options.interactive
          ? selectWithFzf(graph)
          : explicitRoots;

        process.stdout.write(
          renderDependencyTree(
            graph,
            selectedRoots.length > 0 ? selectedRoots : undefined,
          ),
        );
      },
    );

  await program.parseAsync(argv);
}

runCli().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`issue-dependency-tree: ${message}\n`);
  process.exitCode = 1;
});

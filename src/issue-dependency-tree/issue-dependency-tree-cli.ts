import { selectMany } from "../cli/prompts/index.ts";
import { Command } from "commander";
import {
  dependencyGraphJson,
  dependencyNodeNumbers,
  renderDependencyTree,
  type DependencyGraph,
} from "./issue-dependency-tree";
import { fetchDependencyGraph, resolveRepository } from "./github";

async function selectRoots(graph: DependencyGraph): Promise<number[]> {
  const choices = dependencyNodeNumbers(graph).map((number) => {
    const node = graph[String(number)];
    return { name: `#${number} [${node.state}] ${node.title}`, value: String(number) };
  });
  const selected = await selectMany(choices, "Issue root");
  return selected.map(Number);
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
      "Select issue roots interactively (fzf with Inquirer fallback)",
    )
    .option("--json", "Print dependency graph JSON instead of Markdown")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  issue-dependency-tree",
        "  issue-dependency-tree --repo moyarich/workspace-tools",
        "  issue-dependency-tree --root 12 --root 18",
        "  issue-dependency-tree --interactive",
        "  issue-dependency-tree --json",
      ].join("\n"),
    )
    .action(
      async (options: {
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
          ? await selectRoots(graph)
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

export type DependencyIssue = {
  number: number;
  title: string;
  state: string;
  url?: string;
};

export type DependencyNode = DependencyIssue & {
  blockedBy: DependencyIssue[];
  blocking: DependencyIssue[];
};

export type DependencyGraph = Record<string, DependencyNode>;

type RawRelation = { nodes?: DependencyIssue[] } | DependencyIssue[] | null | undefined;

function relation(value: RawRelation): DependencyIssue[] {
  if (Array.isArray(value)) return value;
  return value?.nodes ?? [];
}

export function normalizeDependencyNode(value: {
  number: number;
  title: string;
  state: string;
  url?: string;
  blockedBy?: RawRelation;
  blocking?: RawRelation;
}): DependencyNode {
  return {
    number: value.number,
    title: value.title,
    state: value.state,
    url: value.url,
    blockedBy: relation(value.blockedBy),
    blocking: relation(value.blocking),
  };
}

export function buildDependencyGraph(
  values: Parameters<typeof normalizeDependencyNode>[0][],
): DependencyGraph {
  return Object.fromEntries(
    values.map((value) => {
      const node = normalizeDependencyNode(value);
      return [String(node.number), node];
    }),
  );
}

export function dependencyNodeNumbers(graph: DependencyGraph): number[] {
  return Object.values(graph)
    .filter((node) => node.blockedBy.length > 0 || node.blocking.length > 0)
    .map((node) => node.number)
    .sort((a, b) => a - b);
}

export function rootNumbers(graph: DependencyGraph): number[] {
  return Object.values(graph)
    .filter((node) => node.blocking.length > 0 && node.blockedBy.length === 0)
    .map((node) => node.number)
    .sort((a, b) => a - b);
}

function renderNode(
  graph: DependencyGraph,
  number: number,
  indent: string,
  ancestors: Set<number>,
  rendered: Set<number>,
): string[] {
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
        rendered,
      ),
    );
  }

  return lines;
}

export function renderDependencyTree(
  graph: DependencyGraph,
  selectedRoots?: number[],
): string {
  const dependencyNumbers = dependencyNodeNumbers(graph);

  if (dependencyNumbers.length === 0) {
    return [
      "# Issue dependency tree",
      "",
      "Top-down: each issue blocks the indented issues below it.",
      "",
      "_No native issue dependencies found._",
      "",
    ].join("\n");
  }

  const roots =
    selectedRoots && selectedRoots.length > 0 ? selectedRoots : rootNumbers(graph);
  const rendered = new Set<number>();
  const lines = [
    "# Issue dependency tree",
    "",
    "Top-down: each issue blocks the indented issues below it.",
    "",
  ];

  for (const root of roots) {
    lines.push(...renderNode(graph, root, "", new Set(), rendered));
  }

  if (!selectedRoots || selectedRoots.length === 0) {
    for (const number of dependencyNumbers) {
      if (rendered.has(number)) continue;
      lines.push("", "## Unrooted dependency chain", "");
      lines.push(...renderNode(graph, number, "", new Set(), rendered));
    }
  }

  return `${lines.join("\n")}\n`;
}

export function dependencyGraphJson(graph: DependencyGraph): string {
  const filtered = Object.fromEntries(
    Object.entries(graph)
      .filter(([, node]) => node.blockedBy.length > 0 || node.blocking.length > 0)
      .map(([key, node]) => [
        key,
        {
          number: node.number,
          title: node.title,
          state: node.state,
          blockedBy: node.blockedBy,
          blocking: node.blocking,
        },
      ]),
  );

  return JSON.stringify(filtered, null, 2);
}

import { describe, expect, it } from "vitest";
import {
  buildDependencyGraph,
  dependencyGraphJson,
  dependencyNodeNumbers,
  renderDependencyTree,
  rootNumbers,
} from "../../src/issue-dependency-tree/issue-dependency-tree";

describe("issue dependency tree core", () => {
  const graph = buildDependencyGraph([
    {
      number: 1,
      title: "Parent",
      state: "OPEN",
      blockedBy: { nodes: [] },
      blocking: {
        nodes: [{ number: 2, title: "Child", state: "OPEN" }],
      },
    },
    {
      number: 2,
      title: "Child",
      state: "OPEN",
      blockedBy: {
        nodes: [{ number: 1, title: "Parent", state: "OPEN" }],
      },
      blocking: {
        nodes: [{ number: 3, title: "Leaf", state: "CLOSED" }],
      },
    },
    {
      number: 3,
      title: "Leaf",
      state: "CLOSED",
      blockedBy: {
        nodes: [{ number: 2, title: "Child", state: "OPEN" }],
      },
      blocking: { nodes: [] },
    },
    {
      number: 4,
      title: "Unrelated",
      state: "OPEN",
      blockedBy: { nodes: [] },
      blocking: { nodes: [] },
    },
  ]);

  it("finds dependency-bearing nodes and roots", () => {
    expect(dependencyNodeNumbers(graph)).toEqual([1, 2, 3]);
    expect(rootNumbers(graph)).toEqual([1]);
  });

  it("renders a top-down dependency tree", () => {
    expect(renderDependencyTree(graph)).toContain(
      "- #1 — Parent [OPEN]\n  - #2 — Child [OPEN]\n    - #3 — Leaf [CLOSED]",
    );
  });

  it("renders selected roots without unrelated branches", () => {
    const rendered = renderDependencyTree(graph, [2]);
    expect(rendered).toContain("- #2 — Child [OPEN]");
    expect(rendered).not.toContain("- #1 — Parent [OPEN]");
  });

  it("filters unrelated issues from graph JSON", () => {
    const json = JSON.parse(dependencyGraphJson(graph));
    expect(Object.keys(json)).toEqual(["1", "2", "3"]);
  });

  it("detects cycles while rendering", () => {
    const cyclic = buildDependencyGraph([
      {
        number: 10,
        title: "A",
        state: "OPEN",
        blockedBy: { nodes: [{ number: 11, title: "B", state: "OPEN" }] },
        blocking: { nodes: [{ number: 11, title: "B", state: "OPEN" }] },
      },
      {
        number: 11,
        title: "B",
        state: "OPEN",
        blockedBy: { nodes: [{ number: 10, title: "A", state: "OPEN" }] },
        blocking: { nodes: [{ number: 10, title: "A", state: "OPEN" }] },
      },
    ]);

    expect(renderDependencyTree(cyclic)).toContain("⚠ cycle detected");
  });
});

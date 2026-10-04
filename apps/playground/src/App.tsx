import { useMemo, useState } from "react";

const workflowModules = import.meta.glob(
  "../../../examples/.github/workflows/*.{yml,yaml}",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
) as Record<string, string>;

type WorkflowExample = {
  name: string;
  path: string;
  source: string;
};

function toWorkflowExample([path, source]: [string, string]): WorkflowExample {
  const name = path.split("/").at(-1) ?? path;

  return {
    name,
    path: path.replace("../../../", ""),
    source,
  };
}

export function App() {
  const workflows = useMemo(
    () =>
      Object.entries(workflowModules)
        .map(toWorkflowExample)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const [selectedPath, setSelectedPath] = useState(workflows[0]?.path ?? "");

  const selectedWorkflow =
    workflows.find((workflow) => workflow.path === selectedPath) ?? workflows[0];

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="eyebrow">moyarich/actions</p>
          <h1>GitHub Actions Playground</h1>
          <p>
            Browse the repository-owned caller examples that demonstrate the
            reusable workflows published by this repository.
          </p>
        </div>
        <a href="https://github.com/moyarich/actions">GitHub repository</a>
      </header>

      <main className="playground">
        <aside className="workflow-list" aria-label="Workflow examples">
          <h2>Workflow examples</h2>
          <p>
            Source: <code>examples/.github/workflows</code>
          </p>

          <nav>
            {workflows.map((workflow) => (
              <button
                key={workflow.path}
                type="button"
                className={
                  workflow.path === selectedWorkflow?.path ? "active" : undefined
                }
                onClick={() => setSelectedPath(workflow.path)}
              >
                {workflow.name}
              </button>
            ))}
          </nav>
        </aside>

        <section className="workflow-source">
          {selectedWorkflow ? (
            <>
              <div className="source-header">
                <div>
                  <p className="eyebrow">Copyable caller</p>
                  <h2>{selectedWorkflow.name}</h2>
                </div>
                <code>{selectedWorkflow.path}</code>
              </div>

              <pre>
                <code>{selectedWorkflow.source}</code>
              </pre>
            </>
          ) : (
            <p>No workflow examples were found.</p>
          )}
        </section>
      </main>
    </div>
  );
}

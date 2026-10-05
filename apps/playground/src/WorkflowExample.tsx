const workflowModules = import.meta.glob(
  "../../../examples/*/workflow.{yml,yaml}",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
) as Record<string, string>;

type WorkflowExampleProps = {
  name: string;
};

export function WorkflowExample({ name }: WorkflowExampleProps) {
  const entry = Object.entries(workflowModules).find(([path]) =>
    path.includes(`/examples/${name}/workflow.`),
  );

  if (!entry) {
    return (
      <p>
        Workflow source not found for <code>{name}</code>.
      </p>
    );
  }

  const [path, source] = entry;
  const sourcePath = path.replace("../../../", "");

  return (
    <section className="workflow-example">
      <div className="workflow-example-header">
        <strong>Copyable caller</strong>
        <code>{sourcePath}</code>
      </div>
      <pre>
        <code>{source}</code>
      </pre>
    </section>
  );
}

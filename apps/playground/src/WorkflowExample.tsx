const callerModules = import.meta.glob(
  "../../../examples/*/workflow.{yml,yaml}",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
) as Record<string, string>;

const reusableWorkflowModules = import.meta.glob(
  "../../../.github/workflows/reusable_*.{yml,yaml}",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
) as Record<string, string>;

type WorkflowExampleProps = {
  name: string;
};

function getReusableWorkflowPath(callerSource: string) {
  const match = callerSource.match(
    /uses:\s*moyarich\/actions\/(\.github\/workflows\/reusable_[^@\s]+)@[^\s]+/,
  );

  return match?.[1];
}

function SourceBlock({
  label,
  sourcePath,
  source,
}: {
  label: string;
  sourcePath: string;
  source: string;
}) {
  return (
    <section className="workflow-source">
      <div className="workflow-example-header">
        <strong>{label}</strong>
        <code>{sourcePath}</code>
      </div>
      <pre>
        <code>{source}</code>
      </pre>
    </section>
  );
}

export function WorkflowExample({ name }: WorkflowExampleProps) {
  const callerEntry = Object.entries(callerModules).find(([path]) =>
    path.includes(`/examples/${name}/workflow.`),
  );

  if (!callerEntry) {
    return (
      <p>
        Workflow usage not found for <code>{name}</code>.
      </p>
    );
  }

  const [callerPath, callerSource] = callerEntry;
  const callerSourcePath = callerPath.replace("../../../", "");
  const reusableWorkflowPath = getReusableWorkflowPath(callerSource);
  const reusableEntry = reusableWorkflowPath
    ? Object.entries(reusableWorkflowModules).find(([path]) =>
        path.endsWith(reusableWorkflowPath),
      )
    : undefined;

  return (
    <section className="workflow-example">
      <SourceBlock
        label="Real usage"
        sourcePath={callerSourcePath}
        source={callerSource}
      />

      {reusableEntry ? (
        <SourceBlock
          label="Reusable workflow"
          sourcePath={reusableWorkflowPath!}
          source={reusableEntry[1]}
        />
      ) : (
        <p className="workflow-source-missing">
          The caller does not reference a matching reusable workflow in this
          repository.
        </p>
      )}
    </section>
  );
}

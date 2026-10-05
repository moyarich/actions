import { useMemo, useState } from "react";

export type PlaygroundFile = {
  name: string;
  source: string;
  language?: string;
};

type PlaygroundProps = {
  files: PlaygroundFile[];
};

export function Playground({ files }: PlaygroundProps) {
  const [activeName, setActiveName] = useState(files[0]?.name ?? "");
  const activeFile = useMemo(
    () => files.find((file) => file.name === activeName) ?? files[0],
    [activeName, files],
  );

  if (!activeFile) {
    return <p>No playground files were provided.</p>;
  }

  return (
    <section className="example-playground">
      <div
        className="example-playground-tabs"
        role="tablist"
        aria-label="Source files"
      >
        {files.map((file) => (
          <button
            key={file.name}
            type="button"
            role="tab"
            aria-selected={file.name === activeFile.name}
            className={file.name === activeFile.name ? "active" : undefined}
            onClick={() => setActiveName(file.name)}
          >
            {file.name}
          </button>
        ))}
      </div>
      <div className="example-playground-editor" role="tabpanel">
        <pre>
          <code>{activeFile.source}</code>
        </pre>
      </div>
    </section>
  );
}

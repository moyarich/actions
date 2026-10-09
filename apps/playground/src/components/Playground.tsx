import Editor from "@monaco-editor/react";
import { useMemo, useState } from "react";

import "./Playground.css";

export type PlaygroundFile = {
  name: string;
  source: string;
  language?: string;
};

type PlaygroundProps = {
  files: PlaygroundFile[];
  editable?: boolean;
  height?: number;
};

export function Playground({
  files,
  editable = false,
  height = 360,
}: PlaygroundProps) {
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
        <Editor
          height={`${height}px`}
          keepCurrentModel
          path={activeFile.name}
          language={activeFile.language}
          value={activeFile.source}
          theme="vs-dark"
          options={{
            readOnly: !editable,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: "on",
          }}
        />
      </div>
    </section>
  );
}

/** Reusable MDX-facing Monaco tabs. Accepts the same file data as Playground. */
export function MonacoCodeGroup(props: PlaygroundProps) {
  return <Playground {...props} />;
}

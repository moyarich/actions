export type TypedVersion = {
  mode: "auto" | "bump" | "exact" | "package-json";
  bump?: string;
  exactVersion?: string;
};
export type TypedTarget = {
  kind: "repository" | "package" | "directory";
  value?: string;
};
export type TypedSource = {
  source: "workspace" | "registry" | "repository";
  value?: string;
};
export type TypedRelease = { kind: "auto" | "tag" | "name"; value?: string };

function split(value: string, field: string): [string, string | undefined] {
  const index = value.indexOf(":");
  const kind = index === -1 ? value : value.slice(0, index);
  const detail = index === -1 ? undefined : value.slice(index + 1);
  if (!kind || detail === "" || /[\r\n]/.test(value)) {
    throw new Error(`Invalid ${field} selection: ${JSON.stringify(value)}`);
  }
  return [kind, detail];
}
function bare(detail: string | undefined, field: string): void {
  if (detail !== undefined) throw new Error(`${field} does not accept a value`);
}
function required(detail: string | undefined, field: string): string {
  if (!detail) throw new Error(`${field} requires a value`);
  return detail;
}
export function parseTypedVersion(value: string): TypedVersion {
  const [kind, detail] = split(value, "version");
  switch (kind) {
    case "auto":
    case "package-json":
      bare(detail, kind);
      return { mode: kind };
    case "bump": {
      const bump = required(detail, kind);
      if (
        ![
          "patch",
          "minor",
          "major",
          "prepatch",
          "preminor",
          "premajor",
          "prerelease",
        ].includes(bump)
      )
        throw new Error(`Unsupported version bump: ${bump}`);
      return { mode: "bump", bump };
    }
    case "exact": {
      const exactVersion = required(detail, kind);
      if (
        !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
          exactVersion,
        )
      )
        throw new Error(`Invalid semantic version: ${exactVersion}`);
      return { mode: "exact", exactVersion };
    }
    default:
      throw new Error(`Unsupported version selection: ${kind}`);
  }
}
export function parseTypedTarget(value: string): TypedTarget {
  const [kind, detail] = split(value, "target");
  if (kind === "repository") {
    bare(detail, kind);
    return { kind };
  }
  if (kind === "package" || kind === "directory")
    return { kind, value: required(detail, kind) };
  throw new Error(`Unsupported target selection: ${kind}`);
}
export function parseTypedSource(value: string): TypedSource {
  const [source, detail] = split(value, "workspace-tools");
  if (source === "workspace") {
    bare(detail, source);
    return { source };
  }
  if (source === "registry" || source === "repository")
    return { source, value: required(detail, source) };
  throw new Error(`Unsupported workspace-tools selection: ${source}`);
}
export function parseTypedRelease(value: string): TypedRelease {
  const [kind, detail] = split(value, "release");
  if (kind === "auto") {
    bare(detail, kind);
    return { kind };
  }
  if (kind === "tag" || kind === "name")
    return { kind, value: required(detail, kind) };
  throw new Error(`Unsupported release selection: ${kind}`);
}

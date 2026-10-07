import { execFileSync } from "node:child_process";

export type RestoreSourceKind =
  "commit" | "tag" | "run" | "artifact" | "github-url";

export type ResolvedRestoreSourceKind = "commit" | "tag" | "run" | "artifact";

export interface RestoreSourceResolution {
  source: string;
  kind: RestoreSourceKind;
  resolvedKind: ResolvedRestoreSourceKind;
  value: string;
  commit: string;
}

interface RestoreResolverContext {
  repository: string;
}

type RestoreSourceResolver = (
  value: string,
  context: RestoreResolverContext,
) => Omit<RestoreSourceResolution, "source" | "kind">;

function command(command: string, args: string[]): string {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function resolveCommit(value: string): string {
  if (!value) throw new Error("commit: requires a SHA.");

  try {
    return command("git", ["rev-parse", "--verify", `${value}^{commit}`]);
  } catch {
    throw new Error(`Commit does not exist: ${value}`);
  }
}

function resolveTag(value: string): string {
  if (!value) throw new Error("tag: requires a tag name.");

  try {
    return command("git", [
      "rev-parse",
      "--verify",
      `refs/tags/${value}^{commit}`,
    ]);
  } catch {
    throw new Error(`Tag does not exist: ${value}`);
  }
}

function resolveRun(value: string, repository: string): string {
  if (!/^\d+$/.test(value)) {
    throw new Error("run: requires a numeric workflow run ID.");
  }

  try {
    return command("gh", [
      "api",
      `repos/${repository}/actions/runs/${value}`,
      "--jq",
      ".head_sha",
    ]);
  } catch {
    throw new Error(`Workflow run does not exist or is inaccessible: ${value}`);
  }
}

function resolveArtifact(value: string, repository: string): string {
  if (!/^\d+$/.test(value)) {
    throw new Error("artifact: requires a numeric workflow artifact ID.");
  }

  try {
    const sha = command("gh", [
      "api",
      `repos/${repository}/actions/artifacts/${value}`,
      "--jq",
      ".workflow_run.head_sha // empty",
    ]);

    if (!sha) {
      throw new Error();
    }

    return sha;
  } catch {
    throw new Error(
      `Workflow artifact does not exist, is inaccessible, or has no workflow run commit: ${value}`,
    );
  }
}

function parseGithubUrl(
  value: string,
  repository: string,
): { kind: ResolvedRestoreSourceKind; value: string } {
  if (!value) throw new Error("github-url: requires a GitHub URL.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid GitHub URL: ${value}`);
  }

  if (url.protocol !== "https:" || url.hostname !== "github.com") {
    throw new Error("github-url: must use https://github.com.");
  }

  const [owner, repo, ...parts] = url.pathname
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);

  if (`${owner}/${repo}` !== repository) {
    throw new Error(
      `github-url: must belong to the current repository: ${repository}`,
    );
  }

  if (parts[0] === "commit" && parts[1]) {
    return { kind: "commit", value: parts[1] };
  }

  if (parts[0] === "releases" && parts[1] === "tag" && parts[2]) {
    return { kind: "tag", value: parts.slice(2).join("/") };
  }

  if (
    parts[0] === "actions" &&
    parts[1] === "runs" &&
    /^\d+$/.test(parts[2] ?? "") &&
    parts[3] === "artifacts" &&
    /^\d+$/.test(parts[4] ?? "")
  ) {
    return { kind: "artifact", value: parts[4]! };
  }

  if (
    parts[0] === "actions" &&
    parts[1] === "runs" &&
    /^\d+$/.test(parts[2] ?? "")
  ) {
    return { kind: "run", value: parts[2]! };
  }

  throw new Error(`Unsupported GitHub URL for restore-source: ${value}`);
}

const restoreSourceDispatch: Record<RestoreSourceKind, RestoreSourceResolver> =
  {
    commit: (value) => ({
      resolvedKind: "commit",
      value,
      commit: resolveCommit(value),
    }),
    tag: (value) => ({
      resolvedKind: "tag",
      value,
      commit: resolveTag(value),
    }),
    run: (value, { repository }) => ({
      resolvedKind: "run",
      value,
      commit: resolveCommit(resolveRun(value, repository)),
    }),
    artifact: (value, { repository }) => ({
      resolvedKind: "artifact",
      value,
      commit: resolveCommit(resolveArtifact(value, repository)),
    }),
    "github-url": (value, context) => {
      const parsed = parseGithubUrl(value, context.repository);
      const resolved = restoreSourceDispatch[parsed.kind](
        parsed.value,
        context,
      );

      return {
        resolvedKind: parsed.kind,
        value: parsed.value,
        commit: resolved.commit,
      };
    },
  };

export function resolveRestoreSource(
  source: string,
  repository: string,
): RestoreSourceResolution {
  const separator = source.indexOf(":");
  if (separator < 1) {
    throw new Error(
      "restore-source must use commit:<sha>, tag:<tag>, run:<run-id>, artifact:<artifact-id>, or github-url:<supported-github-url>.",
    );
  }

  const kind = source.slice(0, separator) as RestoreSourceKind;
  const value = source.slice(separator + 1);
  const resolver = restoreSourceDispatch[kind];

  if (!resolver) {
    throw new Error(
      `Unsupported restore-source kind: ${kind}. Use commit, tag, run, artifact, or github-url.`,
    );
  }

  const resolved = resolver(value, { repository });
  return {
    source,
    kind,
    ...resolved,
  };
}

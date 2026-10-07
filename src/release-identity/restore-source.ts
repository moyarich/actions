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

type RestoreCommand = (command: string, args: string[]) => string;

interface RestoreResolverContext {
  repository: string;
  command: RestoreCommand;
}

export interface RestoreSourceDependencies {
  command?: RestoreCommand;
}

type RestoreSourceResolver = (
  value: string,
  context: RestoreResolverContext,
) => Omit<RestoreSourceResolution, "source" | "kind">;

function defaultCommand(command: string, args: string[]): string {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function resolveCommit(value: string, command: RestoreCommand): string {
  if (!value) throw new Error("commit: requires a SHA.");

  try {
    return command("git", ["rev-parse", "--verify", `${value}^{commit}`]);
  } catch {
    throw new Error(`Commit does not exist: ${value}`);
  }
}

function resolveTag(value: string, command: RestoreCommand): string {
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

interface WorkflowRunSource {
  commit: string;
  path: string;
}

function resolveWorkflowRun(
  value: string,
  repository: string,
  command: RestoreCommand,
): WorkflowRunSource {
  if (!/^\d+$/.test(value)) {
    throw new Error("run: requires a numeric workflow run ID.");
  }

  let output: string;
  try {
    output = command("gh", [
      "api",
      `repos/${repository}/actions/runs/${value}`,
      "--jq",
      "[.head_sha, .path] | @tsv",
    ]);
  } catch {
    throw new Error(`Workflow run does not exist or is inaccessible: ${value}`);
  }

  const [commit = "", path = ""] = output.split("\t");

  if (!commit || !path) {
    throw new Error(`Workflow run is missing source metadata: ${value}`);
  }

  if (/(^|\/)(reset-release|restore-release)\.ya?ml$/.test(path)) {
    throw new Error(
      `Recovery workflow run ${value} is not valid Restore provenance. Use the original publish/release run, artifact, tag, commit, or GitHub URL instead.`,
    );
  }

  return { commit, path };
}

function resolveRun(
  value: string,
  repository: string,
  command: RestoreCommand,
): string {
  return resolveWorkflowRun(value, repository, command).commit;
}

function resolveArtifact(
  value: string,
  repository: string,
  command: RestoreCommand,
): string {
  if (!/^\d+$/.test(value)) {
    throw new Error("artifact: requires a numeric workflow artifact ID.");
  }

  let runId: string;
  try {
    runId = command("gh", [
      "api",
      `repos/${repository}/actions/artifacts/${value}`,
      "--jq",
      ".workflow_run.id // empty",
    ]);
  } catch {
    throw new Error(
      `Workflow artifact does not exist or is inaccessible: ${value}`,
    );
  }

  if (!/^\d+$/.test(runId)) {
    throw new Error(
      `Workflow artifact has no valid workflow run provenance: ${value}`,
    );
  }

  return resolveWorkflowRun(runId, repository, command).commit;
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
    commit: (value, { command }) => ({
      resolvedKind: "commit",
      value,
      commit: resolveCommit(value, command),
    }),
    tag: (value, { command }) => ({
      resolvedKind: "tag",
      value,
      commit: resolveTag(value, command),
    }),
    run: (value, { repository, command }) => ({
      resolvedKind: "run",
      value,
      commit: resolveCommit(resolveRun(value, repository, command), command),
    }),
    artifact: (value, { repository, command }) => ({
      resolvedKind: "artifact",
      value,
      commit: resolveCommit(
        resolveArtifact(value, repository, command),
        command,
      ),
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
  dependencies: RestoreSourceDependencies = {},
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

  const resolved = resolver(value, {
    repository,
    command: dependencies.command ?? defaultCommand,
  });

  return {
    source,
    kind,
    ...resolved,
  };
}

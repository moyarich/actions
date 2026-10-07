import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { packageInfo } from "../workspace/workspace.ts";

export interface RestoreEquivalenceResult {
  packageName: string;
  version: string;
  commit: string;
  registry: string;
  equivalent: boolean;
  publishedIntegrity: string;
  candidateIntegrity: string;
  differences: string[];
}

export interface RestoreEquivalenceAttempt {
  registry: string;
  equivalent: boolean;
  result?: RestoreEquivalenceResult;
  error?: string;
}

export interface RestoreEquivalenceSummary {
  equivalent: boolean;
  matchedRegistry: string | null;
  attempts: RestoreEquivalenceAttempt[];
}

function run(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    capture?: boolean;
  } = {},
): string {
  return execFileSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio:
      options.capture === false ? "inherit" : ["ignore", "pipe", "inherit"],
  }).trim();
}

function packageSelectorPath(
  root: string,
  selector: string,
): { directory: string; name: string; version: string } {
  const pkg = packageInfo(root, selector);
  return {
    directory: pkg.directory,
    name: pkg.manifest.name,
    version: pkg.manifest.version,
  };
}

function packPackage(
  root: string,
  selector: string,
  destination: string,
): string {
  const pkg = packageInfo(root, selector);

  const buildArgs =
    pkg.directory === "."
      ? ["run", "build", "--if-present"]
      : ["run", "build", "--workspace", pkg.manifest.name, "--if-present"];

  run("npm", buildArgs, { cwd: root, capture: false });

  const packArgs =
    pkg.directory === "."
      ? ["pack", "--json", "--pack-destination", destination]
      : [
          "pack",
          "--workspace",
          pkg.manifest.name,
          "--json",
          "--pack-destination",
          destination,
        ];

  const result = JSON.parse(run("npm", packArgs, { cwd: root })) as Array<{
    filename?: string;
  }>;

  const filename = result[0]?.filename;
  if (!filename) {
    throw new Error("npm pack did not return a package filename.");
  }

  return resolve(destination, filename);
}

function downloadPublishedPackage(
  name: string,
  version: string,
  registry: string,
  destination: string,
): string {
  const registryUrl = new URL(registry);
  const npmrcDirectory = mkdtempSync(
    join(tmpdir(), "workspace-restore-registry-"),
  );
  const npmrc = join(npmrcDirectory, "npmrc");
  const token =
    registryUrl.hostname === "npm.pkg.github.com"
      ? (process.env.GH_TOKEN ??
        process.env.NODE_AUTH_TOKEN ??
        process.env._GITHUB_TOKEN)
      : process.env.NODE_AUTH_TOKEN;

  const config = [`registry=${registry}`];

  if (token) {
    config.push(`//${registryUrl.host}/:_authToken=${token}`);
  }

  writeFileSync(npmrc, config.concat("").join("\n"));

  try {
    const result = JSON.parse(
      run(
        "npm",
        [
          "pack",
          `${name}@${version}`,
          "--json",
          "--registry",
          registry,
          "--pack-destination",
          destination,
        ],
        {
          env: {
            ...process.env,
            NPM_CONFIG_USERCONFIG: npmrc,
            npm_config_userconfig: npmrc,
          },
        },
      ),
    ) as Array<{ filename?: string }>;

    const filename = result[0]?.filename;
    if (!filename) {
      throw new Error(
        `Unable to download published package ${name}@${version} from ${registry}.`,
      );
    }

    return resolve(destination, filename);
  } finally {
    rmSync(npmrcDirectory, { recursive: true, force: true });
  }
}

function extractPackage(tarball: string, destination: string): string {
  mkdirSync(destination, { recursive: true });
  run("tar", ["-xzf", tarball, "-C", destination]);
  return join(destination, "package");
}

function fileEntries(root: string): string[] {
  const entries: string[] = [];

  function visit(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        entries.push(relative(root, path).replaceAll("\\", "/"));
      } else {
        throw new Error(
          `Unsupported package entry type during Restore verification: ${relative(root, path)}`,
        );
      }
    }
  }

  visit(root);
  return entries.sort();
}

function digestFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function packageTreeDigest(root: string): {
  integrity: string;
  files: Map<string, string>;
} {
  const files = new Map<string, string>();

  for (const path of fileEntries(root)) {
    files.set(path, digestFile(join(root, path)));
  }

  const aggregate = [...files.entries()]
    .map(([path, digest]) => `${path}\0${digest}\n`)
    .join("");

  return {
    integrity: `sha256-${createHash("sha256").update(aggregate).digest("hex")}`,
    files,
  };
}

function diffPackageTrees(
  published: Map<string, string>,
  candidate: Map<string, string>,
): string[] {
  const paths = [...new Set([...published.keys(), ...candidate.keys()])].sort();
  const differences: string[] = [];

  for (const path of paths) {
    if (!published.has(path)) {
      differences.push(`candidate-only:${path}`);
    } else if (!candidate.has(path)) {
      differences.push(`published-only:${path}`);
    } else if (published.get(path) !== candidate.get(path)) {
      differences.push(`different:${path}`);
    }
  }

  return differences;
}

export function verifyRestoreArtifactEquivalence(
  repositoryRoot: string,
  selector: string,
  commit: string,
  registry: string,
): RestoreEquivalenceResult {
  const temporaryRoot = mkdtempSync(
    join(tmpdir(), "workspace-restore-equivalence-"),
  );
  const candidateRoot = join(temporaryRoot, "candidate");
  const candidatePack = join(temporaryRoot, "candidate-pack");
  const publishedPack = join(temporaryRoot, "published-pack");
  const candidateExtract = join(temporaryRoot, "candidate-extract");
  const publishedExtract = join(temporaryRoot, "published-extract");

  try {
    run("git", ["worktree", "add", "--detach", candidateRoot, commit], {
      cwd: repositoryRoot,
    });

    run("npm", ["ci", "--ignore-scripts"], {
      cwd: candidateRoot,
      capture: false,
    });

    mkdirSync(candidatePack, { recursive: true });
    mkdirSync(publishedPack, { recursive: true });

    const identity = packageSelectorPath(candidateRoot, selector);
    const candidateTarball = packPackage(
      candidateRoot,
      selector,
      candidatePack,
    );
    const publishedTarball = downloadPublishedPackage(
      identity.name,
      identity.version,
      registry,
      publishedPack,
    );

    if (
      statSync(candidateTarball).size === 0 ||
      statSync(publishedTarball).size === 0
    ) {
      throw new Error("Restore equivalence package tarball is empty.");
    }

    const candidateTree = packageTreeDigest(
      extractPackage(candidateTarball, candidateExtract),
    );
    const publishedTree = packageTreeDigest(
      extractPackage(publishedTarball, publishedExtract),
    );
    const differences = diffPackageTrees(
      publishedTree.files,
      candidateTree.files,
    );

    return {
      packageName: identity.name,
      version: identity.version,
      commit,
      registry,
      equivalent: differences.length === 0,
      publishedIntegrity: publishedTree.integrity,
      candidateIntegrity: candidateTree.integrity,
      differences,
    };
  } finally {
    try {
      run("git", ["worktree", "remove", "--force", candidateRoot], {
        cwd: repositoryRoot,
      });
    } catch {
      rmSync(candidateRoot, { recursive: true, force: true });
    }

    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

export function summarizeRestoreArtifactEquivalence(
  attempts: RestoreEquivalenceAttempt[],
): RestoreEquivalenceSummary {
  const match = attempts.find((attempt) => attempt.equivalent);

  return {
    equivalent: Boolean(match),
    matchedRegistry: match?.registry ?? null,
    attempts,
  };
}

export function verifyRestoreArtifactEquivalenceAny(
  repositoryRoot: string,
  selector: string,
  commit: string,
  registries: string[],
): RestoreEquivalenceSummary {
  if (registries.length === 0) {
    return {
      equivalent: true,
      matchedRegistry: null,
      attempts: [],
    };
  }

  const attempts = registries.map((registry): RestoreEquivalenceAttempt => {
    try {
      const result = verifyRestoreArtifactEquivalence(
        repositoryRoot,
        selector,
        commit,
        registry,
      );

      return {
        registry,
        equivalent: result.equivalent,
        result,
      };
    } catch (error) {
      return {
        registry,
        equivalent: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  return summarizeRestoreArtifactEquivalence(attempts);
}

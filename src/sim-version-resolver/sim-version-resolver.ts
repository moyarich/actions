import semver from "semver";

/** Shared, side-effect-free SemVer resolver for release workflows and CLI. */
const BUMPS = new Set([
  "major",
  "minor",
  "patch",
  "premajor",
  "preminor",
  "prepatch",
  "prerelease",
] as const);

type Bump = Parameters<typeof semver.inc>[1];

/** Resolve a version spec without modifying files or publishing. */
export function resolveNextVersion(
  currentVersion: string,
  versionSpec: string,
): string {
  if (!semver.valid(currentVersion)) {
    throw new Error(`Invalid current SemVer: ${currentVersion}`);
  }

  if (semver.valid(versionSpec)) {
    return versionSpec;
  }

  if (!BUMPS.has(versionSpec as Bump)) {
    throw new Error(`Invalid release bump: ${versionSpec}`);
  }

  const next = semver.inc(currentVersion, versionSpec as Bump);
  if (!next) {
    throw new Error(`Unable to resolve release bump: ${versionSpec}`);
  }
  return next;
}

export function resolveVersionSelection(
  currentVersion: string,
  mode: "bump" | "exact" | "package-json",
  bump = "patch",
  exactVersion = "",
): string {
  if (mode === "package-json") {
    if (!semver.valid(currentVersion)) {
      throw new Error(`Invalid package.json SemVer: ${currentVersion}`);
    }
    return currentVersion;
  }
  if (mode === "exact") {
    if (!semver.valid(exactVersion)) {
      throw new Error(`Invalid exact SemVer: ${exactVersion}`);
    }
    return exactVersion;
  }
  if (mode === "bump") return resolveNextVersion(currentVersion, bump);
  throw new Error(`Invalid release mode: ${mode}`);
}

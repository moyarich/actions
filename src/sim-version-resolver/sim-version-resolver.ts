/** Shared, side-effect-free SemVer resolver for release workflows and CLI. */
const VALID_BUMPS = new Set([
  "major",
  "minor",
  "patch",
  "premajor",
  "preminor",
  "prepatch",
  "prerelease",
]);
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/**
 * Calculate the next package version.
 *
 * @param {string} currentVersion
 * Current semantic version.
 *
 * @param {string} versionSpec
 * Exact version or semantic-version bump.
 *
 * @returns {string}
 * Resolved next version.
 */
export function resolveNextVersion(
  currentVersion: string,
  versionSpec: string,
): string {
  if (!SEMVER.test(currentVersion)) {
    throw new Error(`Invalid current SemVer: ${currentVersion}`);
  }

  if (SEMVER.test(versionSpec)) {
    return versionSpec;
  }

  if (!VALID_BUMPS.has(versionSpec)) {
    throw new Error(`Invalid release bump: ${versionSpec}`);
  }

  // Build metadata has no effect on version precedence or bump arithmetic.
  // Separate it before parsing the core and prerelease identifiers.
  const withoutBuild = currentVersion.split("+", 1)[0]!;
  const [core, prerelease = ""] = withoutBuild.split("-", 2);
  const [major, minor, patch] = core.split(".").map(Number);

  switch (versionSpec) {
    case "major":
      return `${major + 1}.0.0`;

    case "minor":
      return `${major}.${minor + 1}.0`;

    case "patch":
      return `${major}.${minor}.${patch + 1}`;

    case "premajor":
      return `${major + 1}.0.0-0`;

    case "preminor":
      return `${major}.${minor + 1}.0-0`;

    case "prepatch":
      return `${major}.${minor}.${patch + 1}-0`;

    case "prerelease": {
      if (!prerelease) {
        return `${major}.${minor}.${patch + 1}-0`;
      }

      const parts = prerelease.split(".");

      const last = parts.at(-1);

      if (last && /^\d+$/.test(last)) {
        parts[parts.length - 1] = String(Number(last) + 1);
      } else {
        parts.push("0");
      }

      return `${major}.${minor}.${patch}-${parts.join(".")}`;
    }

    default:
      throw new Error(`Unsupported release bump: ${versionSpec}`);
  }
}

export function resolveVersionSelection(
  currentVersion: string,
  mode: "bump" | "exact" | "package-json",
  bump = "patch",
  exactVersion = "",
): string {
  if (mode === "package-json") {
    if (!SEMVER.test(currentVersion))
      throw new Error(`Invalid package.json SemVer: ${currentVersion}`);
    return currentVersion;
  }
  if (mode === "exact") {
    if (!SEMVER.test(exactVersion))
      throw new Error(`Invalid exact SemVer: ${exactVersion}`);
    return exactVersion;
  }
  if (mode === "bump") return resolveNextVersion(currentVersion, bump);
  throw new Error(`Invalid release mode: ${mode}`);
}

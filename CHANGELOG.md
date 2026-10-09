# Changelog

All notable user-facing changes to the installable `@moyarich/workspace-tools` package are documented in this file.

Reusable GitHub workflows and standalone actions are released separately from `moyarich/reusable-workflows`.

## Unreleased

## [0.2.0]

### Breaking changes

- **Named package and directory selectors** — Use `--package <name-or-directory>` with `workspace-release`, `workspace-publish`, `workspace-dependency-check`, and `workspace-release-identity`, and `--directory <path>` with `discover-packages`. Positional package and directory selectors are no longer supported.
- **Explicit release version options** — Select versions with `workspace-release --mode bump --version minor`, `--mode exact --version 0.2.0`, or `--mode package-json`. The previous positional version syntax is no longer supported.

### Interactive commands

- **Guided package selection** — Release, publish, and dependency-check commands can prompt for missing choices when run in an interactive terminal. Larger package lists support searchable selection with `fzf`.
- **Predictable automation** — Commands do not prompt in CI, non-interactive terminals, or JSON mode. Use named options to make scripted invocations unambiguous.

### Publishing

- **Public npm as the default registry** — `workspace-publish` publishes to npm by default. Continue to select GitHub Packages or both registries explicitly with `--registry`.

### Semantic versioning

- **`sim-version-resolver`** — Resolve the next semantic version without changing files or publishing a package. Choose a `bump`, `package-json`, or `exact` version mode, with support for major, minor, patch, and prerelease increments.
- **Machine-readable version results** — Use `sim-version-resolver --json` to retrieve the current and resolved versions for scripts and other tooling. Resolve from an explicit version or a selected package manifest.
- **Preview release versions independently** — Use `workspace-release --resolve-only` to see the selected package version without running release checks or making changes. Supports JSON output.
- **Support initial-development versions** — Minor increments preserve major version zero, so packages can progress from `0.1.0` to `0.2.0` and `0.3.0` before their first stable major release.
- **Correct version bumps with build metadata** — Resolve SemVer increments correctly when the current version includes build metadata.

### Release recovery

- **Resolve historical release sources** — `workspace-release-identity restore-source` resolves a commit, Git tag, GitHub Actions run, workflow artifact, or supported GitHub URL to the commit used for a release recovery. Use `--repository <owner/name>` to identify the repository and `--json` or `--pretty-json` for machine-readable results.
- **Verify published artifact equivalence** — `workspace-release-identity restore-equivalence` compares a package built from a selected historical commit with published package contents from one or more registries. Results identify matching registries and report file-level differences when packages do not match, with text or JSON output.

## [0.1.1]

### Publishing

- **Reuse canonical package artifacts** — `workspace-publish --artifact-file <file>` can publish an existing npm package tarball instead of rebuilding the package from the current checkout.
- **Validate reused artifacts before publishing** — Existing tarballs must contain a readable `package/package.json` whose package name and version match the selected workspace package.
- **Preserve identical package bytes across registries** — A previously created canonical tarball can be reused for later registry publication, allowing GitHub Packages and npm to receive the same package artifact even when they are published at different times.

### Fixed

- **Root package version bumps** — `workspace-release` now bumps the repository root package without incorrectly passing it to npm as a workspace member.

## [0.1.0] - Initial Release

### Workspace discovery and dependency tooling

- **`discover-packages`** — Discover root, workspace, or direct-child packages with filtering and JSON output.
- **`workspace-dependency-check`** — Check external dependencies for outdated versions and detect internal workspace version mismatches.
- **`workspace-package-lock`** — Review or recreate the root npm lockfile, with dry-run and commit modes.

### Releases and publishing

- **`workspace-release-identity`** — Resolve canonical package versions, Git tags, and GitHub Release names.
- **`workspace-release`** — Preview or prepare package releases using semantic bumps, exact versions, or the version already present in `package.json`.
- **`workspace-publish`** — Validate and publish workspace packages with registry, distribution-tag, access, dependency, artifact, dry-run, and Git tag verification controls.

### Issue dependencies

- **`issue-dependency-tree`** — Inspect native GitHub issue dependencies from the terminal, select roots explicitly or interactively with optional `fzf` multi-select, and emit Markdown or JSON output.

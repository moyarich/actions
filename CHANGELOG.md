# Changelog

All notable user-facing changes to the installable `@moyarich/workspace-tools` package are documented in this file.

Reusable GitHub workflows and standalone actions are released separately from `moyarich/reusable-workflows`.

## Unreleased

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

# Changelog

All notable user-facing changes to the installable `@moyarich/workspace-tools` package are documented in this file.

Reusable GitHub workflows and standalone actions are released separately from `moyarich/reusable-workflows`.

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

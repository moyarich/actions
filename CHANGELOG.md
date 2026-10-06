# Changelog

All notable user-facing changes to this project will be documented in this file.

The changelog is the canonical source used to seed the initial GitHub Release draft. It describes what consumers can do with Workspace Tools, not how this repository is maintained or shipped.

## [0.1.0] - Initial Release

### CI and package automation

- **`reusable_node-ci.yml`** — Run Node.js CI for the repository root or a selected workspace package. Builds the selected package and its local workspace dependencies, runs tests, linting, and type checking, and validates workspace package contents with `npm pack`.
- **`reusable_package-ci.yml`** — Discover packages with test scripts and run reusable Node.js CI across them as a GitHub Actions matrix.
- **`reusable_check-dist.yml`** — Rebuild committed distribution output and verify that it matches the repository. When validation fails, preserve the rebuilt distribution as a downloadable artifact and report the result in the workflow summary.
- **`reusable_discover-packages.yml`** — Discover repository packages from npm workspaces, the root package, or direct children of a package directory. Filter by private status, publish configuration, test scripts, and build scripts, and expose package metadata, matrix data, package count, and match status to downstream jobs.
- **`reusable_prettier.yml`** — Run Prettier self-healing using the repository's declared Prettier version, preview formatting changes, verify the result, and optionally commit corrections back to the current branch.
- **`reusable_npm-package-lock.yml`** — Recreate and validate the root `package-lock.json`, report lockfile drift, and optionally commit a corrected lockfile.

### Releases and publishing

- **`reusable_release-drafter.yml`** — Maintain a persistent GitHub Release draft for a repository or scoped monorepo package, with semantic-version resolution, path-aware release history, and dry-run previews.
- Seed missing release drafts from the matching changelog when available, with Release Drafter PR history, scoped commit history, and an initial-release body as fallbacks.
- Preserve maintainer-authored release text and previously generated entries while appending only newly discovered release-note PRs.
- **`reusable_npm-prepare-release.yml`** — Prepare an npm package release using a semantic version bump, an exact version, or the version already defined in `package.json`. Resolve canonical package version, Git tag, and GitHub Release identity and validate release state before publishing.
- **`reusable_npm-publish.yml`** — Preflight and publish selected workspace packages to npm, GitHub Packages, or all supported registries, with configurable distribution tags, access levels, dependency-aware publishing, package artifacts, dry-run validation, and Git tag verification.
- **`reusable_npm-release.yml`** — Preview and create package releases with changelog visibility, canonical Git tags, and matching GitHub Release drafts, independently from package publishing.
- **`reusable_vscode-extension-publish.yml`** — Validate and package VS Code extensions as VSIX artifacts, publish to the VS Code Marketplace or handle already-published versions, verify canonical tags and versions, support dry runs and release-environment approval, and publish the matching GitHub draft release.
- **`reusable_codemod-publish.yml`** — Validate Codemod Registry packages and workflow definitions, run available build, typecheck, and test commands, support dry runs, and publish through an approved release environment.

### GitHub Pages and documentation automation

- **`reusable_github-pages.yml`** — Build and deploy static sites to GitHub Pages with configurable install and build commands, working and output directories, Node.js versions, and repository-relative base-path support.
- **`reusable_readme-screenshots.yml`** — Start a documentation or demo site, capture configured screenshots with Playwright and `@moyarich/readme-screenshots`, write them to a configurable output directory, and commit changed screenshots.

### Issue dependency automation

- **`reusable_manage-issue-dependencies.yml`** — Add or remove native GitHub `blocked by` and `blocking` relationships between issues, with support for issue numbers or URLs, multiple related issues, and dry-run previews.
- **`reusable_show-issue-dependency-tree.yml`** — Read native GitHub issue dependencies and expose both a rendered Markdown dependency tree and normalized graph JSON for downstream jobs, including cycle-aware traversal.

### Standalone GitHub Actions

- **`discover-packages`** — Discover root, workspace, or direct-child packages directly inside a job and emit normalized package metadata, GitHub Actions matrix data, package counts, and match status.
- **`issue-dependency-tree`** — Render native GitHub issue blocking relationships directly as a cycle-aware Markdown tree and normalized dependency graph.
- **`release-draft-sync`** — Reconcile persistent GitHub Release draft content while treating existing draft text as authoritative and appending only previously unseen generated release entries.

### Workspace Tools CLI

- Install `@moyarich/workspace-tools` to use workspace, dependency, release, publishing, and issue-dependency tooling outside reusable workflows.
- **`discover-packages`** — Discover root, workspace, or direct-child packages with filtering and JSON output.
- **`workspace-dependency-check`** — Check external dependencies for outdated versions and detect internal workspace version mismatches.
- **`workspace-package-lock`** — Review or recreate the root npm lockfile, with dry-run and commit modes.
- **`workspace-release-identity`** — Resolve canonical package versions, Git tags, and GitHub Release names.
- **`workspace-release`** — Preview or prepare package releases using semantic bumps, exact versions, or the version already present in `package.json`.
- **`workspace-publish`** — Validate and publish workspace packages with registry, distribution-tag, access, dependency, artifact, dry-run, and Git tag verification controls.
- **`issue-dependency-tree`** — Inspect native GitHub issue dependencies from the terminal, select roots explicitly or interactively with optional `fzf` multi-select, and emit Markdown or JSON output.

### Documentation and examples

- Start from copyable caller examples for each supported reusable workflow.
- Browse workflow-specific documentation for inputs, outputs, permissions, CI behavior, release management, publishing, GitHub Pages, issue dependencies, and workspace CLI commands.
- Use the versioned **`reusable_*.yml`** workflows as the supported cross-repository GitHub Actions API.

# Changelog

All notable user-facing changes to this project will be documented in this file.

The changelog is the canonical source used to seed the initial GitHub Release draft. It describes what consumers can do with Workspace Tools, not how this repository is maintained or shipped.

## [0.1.0] - Initial Release

### Reusable workflows

- Run reusable Node.js and package CI with configurable Node versions, install commands, checks, and workspace/package targets.
- Verify committed distribution output by rebuilding it, detecting modified, deleted, or untracked generated files, and preserving the rebuilt output as a downloadable workflow artifact when validation fails.
- Discover root, workspace, and direct-child packages with filters for private packages, publish configuration, test scripts, and build scripts, and expose normalized package and matrix outputs for downstream jobs.
- Check or automatically repair Prettier formatting and root `package-lock.json` drift, with dry-run/commit modes and workflow summaries.
- Build and deploy static sites to GitHub Pages with repository-relative base-path support.
- Generate README screenshots through reusable repository automation.
- Manage native GitHub issue blocking relationships and render cycle-aware dependency trees.

### Release drafts and package publishing

- Create persistent GitHub Release drafts for repositories and scoped monorepo packages, with semantic-version resolution, path-aware release history, and dry-run previews.
- Seed a missing release draft from the matching changelog when available, with Release Drafter PR history, scoped commit history, and a minimal initial-release body as fallbacks.
- Preserve maintainer-authored draft text and existing generated entries while appending only newly discovered release-note PRs.
- Prepare npm package releases with bump, exact-version, and package.json version modes, canonical package release identity, dry-run support, and release state validation.
- Publish selected workspace packages to GitHub Packages, npm, or both, with distribution-tag/access controls, dependency-aware publishing, package artifacts, and Git tag verification.
- Run the complete npm release lifecycle through the reusable release workflow.
- Validate, package, and publish VS Code extensions, including dry runs, Marketplace publication, VSIX artifacts, release-environment approval, tag/version verification, already-published mode, and matching GitHub Release publication.
- Validate and publish Codemod Registry packages from configurable package directories.

### Standalone GitHub Actions

- Use `discover-packages` directly to discover repository packages and emit normalized package metadata, GitHub Actions matrix data, package counts, and match status.
- Use `issue-dependency-tree` directly to render native GitHub issue blocking relationships as Markdown and normalized graph JSON.
- Use `release-draft-sync` directly to reconcile persistent release draft content without overwriting maintainer-authored text.

### Workspace Tools CLI

- Install `@moyarich/workspace-tools` and use the same workspace automation outside reusable workflows.
- Discover repository packages from the command line with workspace, root-package, filtering, and JSON output support.
- Inspect native GitHub issue dependencies from the command line, including root selection, JSON output, and optional interactive multi-select with `fzf`.
- Check workspace dependencies for outdated external versions and internal workspace version mismatches.
- Review, recreate, dry-run, or commit the root workspace `package-lock.json`.
- Resolve canonical workspace package release versions, Git tags, and GitHub Release names.
- Preview or create workspace package releases using bump, exact-version, or package.json version modes.
- Validate and publish workspace packages with registry, tag, access, dependency, artifact, dry-run, and Git tag verification options.

### Documentation and examples

- Start from copyable caller examples for the supported reusable workflows.
- Use browsable documentation for workflow inputs, release behavior, workspace CLI commands, and package/repository automation.
- Use `reusable_*.yml` workflows as the supported cross-repository workflow API.

# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - Initial Release

### Reusable workflows

- Node.js CI, package CI, formatting, and workspace package discovery.
- npm package-lock maintenance, release preparation, release orchestration, and publishing.
- Codemod Registry publishing.
- VS Code extension packaging and Marketplace publishing with dry-run support, release-environment approval, Git tag and draft-release validation, VSIX artifacts, and GitHub Release promotion.
- GitHub Pages deployment and README screenshot generation.
- Issue dependency management and dependency-tree reporting.
- Preserve the existing `reusable_*.yml` names from `dev-toolkit` as the public reusable-workflow API.

### Reusable actions

- Reserve `actions/*/action.yml` as the public reusable-action namespace.
- No standalone reusable actions are included in the initial release; shared automation currently ships as reusable workflows.

### Scripts and tooling

- Add a dependency-free validator for the public `reusable_*.yml` workflow contract and GitHub workflow-directory rules.
- Make package discovery cross-repository safe by resolving the published `@moyarich/workspace-tools` CLI instead of requiring `dev-toolkit` source files in the caller repository.
- Add MoyaForge-compatible documentation for repository conventions, getting started, and the reusable workflow catalog.

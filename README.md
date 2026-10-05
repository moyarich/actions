# Moya Actions

Reusable GitHub Actions workflows for CI, package discovery, releases, publishing, GitHub Pages, repository maintenance, and developer tooling.

## Reusable workflows

Use these workflows from another repository with GitHub Actions `workflow_call`.

### CI and package automation

| Workflow                         | Use it to                                                                 |
| -------------------------------- | ------------------------------------------------------------------------- |
| `reusable_node-ci.yml`           | Run configurable Node.js CI.                                              |
| `reusable_package-ci.yml`        | Run CI for a package or workspace target.                                 |
| `reusable_discover-packages.yml` | Discover publishable root and workspace packages for downstream jobs.     |
| `reusable_prettier.yml`          | Check Prettier formatting and optionally commit formatting fixes.         |
| `reusable_npm-package-lock.yml`  | Validate `package-lock.json` and optionally commit regenerated lockfiles. |

### Releases and publishing

| Workflow                                | Use it to                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `reusable_release-drafter.yml`          | Create and update persistent GitHub Release drafts for repositories or scoped monorepo targets. |
| `reusable_npm-prepare-release.yml`      | Prepare an npm package release, including version and release state.                            |
| `reusable_npm-publish.yml`              | Publish selected npm packages and verify the published release.                                 |
| `reusable_npm-release.yml`              | Run the complete npm release lifecycle through one reusable workflow.                           |
| `reusable_vscode-extension-publish.yml` | Validate, package, and publish a VS Code extension and its matching GitHub Release.             |
| `reusable_codemod-publish.yml`          | Validate and publish a Codemod Registry package.                                                |

### Sites and repository tooling

| Workflow                                  | Use it to                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `reusable_github-pages.yml`               | Build and deploy a static site to GitHub Pages with repository-relative base-path support. |
| `reusable_readme-screenshots.yml`         | Generate README screenshots through a reusable workflow.                                   |
| `reusable_manage-issue-dependencies.yml`  | Manage native GitHub issue blocking relationships.                                         |
| `reusable_show-issue-dependency-tree.yml` | Render an issue dependency tree, including cycle-aware output.                             |

## Standalone actions

| Action               | Use it to                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `release-draft-sync` | Reconcile persistent GitHub Release draft content while preserving maintainer-authored text and appending only unseen generated entries. |
| `discover-packages`      | Discover root, workspace, or direct-child packages and emit normalized package and matrix metadata.                                      |
| `issue-dependency-tree`   | Render native GitHub issue blocking relationships as a cycle-aware dependency tree.                                                     |

Use standalone actions directly when you need the lower-level executable behavior:

```yaml
- uses: moyarich/actions/release-draft-sync@v1
- uses: moyarich/actions/discover-packages@v1
- uses: moyarich/actions/issue-dependency-tree@v1
```

## CLI

The package also ships an `issue-dependency-tree` CLI built from the same dependency-graph core used by the GitHub Action.

```sh
issue-dependency-tree
issue-dependency-tree --repo moyarich/actions
issue-dependency-tree --root 29
issue-dependency-tree --interactive
issue-dependency-tree --json
```

Interactive mode uses the external `fzf` executable with multi-select. `fzf` is optional; non-interactive tree and JSON output do not require it.

## Using a workflow

Create a workflow in the consuming repository and call the reusable workflow with `uses`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  ci:
    uses: moyarich/actions/.github/workflows/reusable_node-ci.yml@v0.1.0
```

Each reusable workflow defines its supported inputs, outputs, secrets, and permissions. See the [documentation](./docs/page.mdx) and [examples](./examples) for workflow-specific configuration and copyable callers.

## Versioning

Pin callers to a release tag. Stable major tags may be used when available.

```yaml
jobs:
  ci:
    uses: moyarich/actions/.github/workflows/reusable_node-ci.yml@v0.1.0
```

## License

MIT

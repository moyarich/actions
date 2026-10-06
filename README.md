# @moyarich/workspace-tools

CLI tooling for Node.js workspaces, package discovery, releases, publishing, dependency checks, and repository automation.

Reusable GitHub workflows and standalone Actions are released separately from [moyarich/reusable-workflows](https://github.com/moyarich/reusable-workflows).

## Install

```sh
npm install @moyarich/workspace-tools
```

## Commands

- `discover-packages` — discover root, workspace, and direct-child packages.
- `issue-dependency-tree` — render native GitHub issue dependency graphs.
- `workspace-dependency-check` — check external and internal workspace dependency versions.
- `workspace-package-lock` — validate or recreate the root npm lockfile.
- `workspace-release-identity` — resolve canonical package release identity.
- `workspace-release` — preview and prepare package releases.
- `workspace-publish` — validate and publish canonical package artifacts.

## Releases

The package version comes from `package.json`. User-facing package changes are documented in `CHANGELOG.md`.

Package releases use tags such as:

```text
@moyarich/workspace-tools@0.1.0
```

The repository-local workflows under `.github/workflows/` maintain this repository. Public reusable workflows live in `moyarich/reusable-workflows`.

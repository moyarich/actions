# @moyarich/workspace-tools

Command-line tools for working with Node.js and npm workspaces: discover packages, validate dependency versions, maintain the root lockfile, prepare releases, publish packages, and inspect GitHub issue dependencies.

Use the commands directly in a repository, or compose them into your own local scripts and CI workflows.

## Requirements

- Node.js 24 or newer
- npm 11 or newer

## Install

Install the package in the repository where you want to use the tools:

```sh
npm install --save-dev @moyarich/workspace-tools
```

Then run commands through `npm exec`:

```sh
npm exec -- discover-packages --workspaces --include-root-package
```

> `@moyarich/workspace-tools` is published to GitHub Packages. Configure npm authentication for the `@moyarich` scope when installing from the registry.

## What it provides

| Capability | Command | Use it to |
| --- | --- | --- |
| Package discovery | `discover-packages` | Discover root and workspace packages and expose normalized package metadata. |
| Dependency validation | `workspace-dependency-check` | Find outdated external dependencies and mismatched internal workspace versions. |
| Lockfile maintenance | `workspace-package-lock` | Review, recreate, or commit the root `package-lock.json`. |
| Release preparation | `workspace-release` | Preview or prepare a package release using an exact version, semantic bump, or `package.json` version. |
| Release identity | `workspace-release-identity` | Resolve the canonical package Git tag and GitHub Release name. |
| Publishing | `workspace-publish` | Validate package artifacts and publish to GitHub Packages, npm, or both. |
| Issue dependencies | `issue-dependency-tree` | Render native GitHub issue dependency relationships as a tree or JSON. |

## Quick start

### Discover workspace packages

Discover packages from npm workspace patterns and include the repository root:

```sh
npm exec -- discover-packages --workspaces --include-root-package
```

Use JSON when another tool or workflow needs to consume the result:

```sh
npm exec -- discover-packages --workspaces --include-root-package --json
```

Package discovery can also filter to private packages, publishable packages, or packages that define test/build scripts.

### Check workspace dependencies

Check one package:

```sh
npm exec -- workspace-dependency-check .
```

Check every workspace package:

```sh
npm exec -- workspace-dependency-check --all
```

The command checks both registry versions and internal workspace dependency consistency.

### Review the root package lock

Preview the lockfile operation without keeping changes:

```sh
npm exec -- workspace-package-lock --dry-run
```

Run without `--dry-run` to recreate the root lockfile when needed. The command can also commit and push the resulting `package-lock.json`.

### Preview a release

Use the version already declared in `package.json`:

```sh
npm exec -- workspace-release . --mode=package-json --dry-run
```

Preview a semantic version bump:

```sh
npm exec -- workspace-release workspace-tools=patch --mode=bump --dry-run
```

`workspace-release` supports:

- `package-json` — use the package's current `package.json` version.
- `bump` — resolve a semantic version bump such as `patch`, `minor`, or `major`.
- `exact` — use an explicit version.

### Resolve release identity

See the package name, version, canonical Git tag, and GitHub Release name:

```sh
npm exec -- workspace-release-identity . --pretty-json
```

For example, a package release can resolve to a tag such as:

```text
@moyarich/workspace-tools@0.1.0
```

### Preview publishing

Validate registry readiness and build the canonical package artifact without publishing:

```sh
npm exec -- workspace-publish . --dry-run
```

Publishing supports GitHub Packages, npm, or both, npm distribution tags, package access controls, saved tarball artifacts, and optionally including publishable workspace dependencies.

### Inspect GitHub issue dependencies

Render the dependency tree for the current repository:

```sh
npm exec -- issue-dependency-tree
```

Render specific issue roots:

```sh
npm exec -- issue-dependency-tree --root 12 --root 18
```

Or select roots interactively with `fzf`:

```sh
npm exec -- issue-dependency-tree --interactive
```

## Command help

Every CLI exposes its supported arguments and options through `--help`:

```sh
npm exec -- discover-packages --help
npm exec -- workspace-dependency-check --help
npm exec -- workspace-package-lock --help
npm exec -- workspace-release --help
npm exec -- workspace-release-identity --help
npm exec -- workspace-publish --help
npm exec -- issue-dependency-tree --help
```

## Examples and documentation

Copyable examples live in [`examples/`](./examples), including package discovery, dependency checks, lockfile maintenance, releases, publishing, release identity, and issue dependency trees.

User documentation lives in [`docs/`](./docs). Development-only information belongs under [`docs/04-development/`](./docs/04-development).

## Reusable GitHub workflows

This package contains the CLI tooling. Public reusable GitHub workflows and standalone Actions are maintained separately in [`moyarich/reusable-workflows`](https://github.com/moyarich/reusable-workflows).

## License

MIT

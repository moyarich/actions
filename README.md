# @moyarich/workspace-tools

Command-line tools for Node.js and npm workspaces: discover packages, validate dependency versions, maintain the root lockfile, prepare releases, publish packages, and inspect GitHub issue dependencies.

Run the commands directly in a repository with `npm exec`, or compose them into scripts and CI workflows.

## Requirements

- Node.js 24 or newer
- npm 11 or newer

## Install

```sh
npm install --save-dev @moyarich/workspace-tools
```

### GitHub Packages

Public npm (`registry.npmjs.org`) is the default installation and publishing registry. GitHub Packages is an optional publishing destination; to install from GitHub Packages, explicitly configure npm authentication for the `@moyarich` scope in `.npmrc`:

```ini
@moyarich:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Set `GITHUB_TOKEN` to a GitHub token with permission to read packages before installing.

## Usage

Run any command through `npm exec`. Package selection uses named `--package` options; in a terminal, release and publish commands prompt for missing selections, while CI and JSON invocations must be explicit:

```sh
npm exec -- <command> [arguments] [options]
```

| Command                      | Use it to…                                            | Example                                                                     |
| ---------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `discover-packages`          | Find packages in a repository or workspace            | `npm exec -- discover-packages --workspaces --include-root-package`         |
| `workspace-dependency-check` | Check dependency versions across a workspace          | `npm exec -- workspace-dependency-check --all`                              |
| `workspace-package-lock`     | Review or regenerate the root `package-lock.json`     | `npm exec -- workspace-package-lock --dry-run`                              |
| `workspace-release`          | Decide which version to release                       | `npm exec -- workspace-release --package . --mode bump --version patch --dry-run` |
| `workspace-release-identity` | Resolve the canonical Git tag and GitHub Release name | `npm exec -- workspace-release-identity --package . --pretty-json`                    |
| `workspace-publish`          | Validate and publish a package                        | `npm exec -- workspace-publish --package . --dry-run`                                 |
| `issue-dependency-tree`      | See which GitHub issues block other issues            | `npm exec -- issue-dependency-tree`                                         |

Every command documents its full arguments and options through `--help`:

```sh
npm exec -- workspace-release --help
```

## Commands

### Discover packages

`discover-packages` finds the root and workspace packages in a repository and normalizes their metadata. It understands npm workspace patterns.

```sh
# List all workspace packages, including the root
npm exec -- discover-packages --workspaces --include-root-package

# Output JSON for scripts and CI jobs
npm exec -- discover-packages --workspaces --include-root-package --json
```

It can also filter packages by characteristics such as private, publishable, or having test or build scripts.

### Check workspace dependencies

`workspace-dependency-check` finds outdated external dependencies and internal workspace dependencies whose declared versions don't match the workspace package version.

```sh
# Check one package
npm exec -- workspace-dependency-check .

# Check every workspace package
npm exec -- workspace-dependency-check --all
```

### Maintain the root lockfile

`workspace-package-lock` works on the root `package-lock.json`. Depending on the options, it can inspect the lockfile, recreate it, keep the result, commit the change, and push the commit.

```sh
# Preview what would happen
npm exec -- workspace-package-lock --dry-run

# Apply the operation
npm exec -- workspace-package-lock
```

### Inspect GitHub issue dependencies

`issue-dependency-tree` renders native GitHub issue dependencies as a tree or as data for other tooling.

```sh
# Current repository
npm exec -- issue-dependency-tree

# Start from specific issues
npm exec -- issue-dependency-tree --root 12 --root 18

# Pick issues interactively (requires fzf)
npm exec -- issue-dependency-tree --interactive
```

Example output:

```text
#12 Release package
├── #8 Finish publishing support
│   └── #4 Add registry configuration
└── #10 Complete release documentation
```

## Releasing packages

Three commands handle release work, each with one responsibility:

| Command                      | Answers                                                 |
| ---------------------------- | ------------------------------------------------------- |
| `workspace-release`          | What version are we releasing?                          |
| `workspace-release-identity` | What should this release be called?                     |
| `workspace-publish`          | Is the package ready, and where should it be published? |

A typical flow:

```sh
# 1. Resolve or prepare the package version
npm exec -- workspace-release --package . --mode package-json --dry-run

# 2. Resolve the canonical tag and GitHub Release name
npm exec -- workspace-release-identity --package . --pretty-json

# 3. Validate the package artifact before publishing
npm exec -- workspace-publish --package . --dry-run
```

Remove `--dry-run` when you are ready to perform the operation.

### Prepare a release

`workspace-release` determines or prepares the version being released, using one of three modes:

| Mode           | Purpose                                                           |
| -------------- | ----------------------------------------------------------------- |
| `package-json` | Use the version already declared in the package's `package.json`. |
| `bump`         | Resolve a semantic increment: `patch`, `minor`, or `major`.       |
| `exact`        | Release an explicitly supplied version.                           |

```sh
# Use the package.json version
npm exec -- workspace-release --package . --mode package-json --dry-run

# Preview a patch release
npm exec -- workspace-release --package . --mode bump --version patch --dry-run
```

### Resolve release identity

`workspace-release-identity` resolves the canonical package name, version, Git tag, and GitHub Release name, so release automation has one authoritative source for naming. Run it once the package and version are known.

```sh
npm exec -- workspace-release-identity --package . --pretty-json
```

For example, `@moyarich/workspace-tools` version `0.1.0` resolves to the tag:

```text
@moyarich/workspace-tools@0.1.0
```

### Publish a package

`workspace-publish` validates publishing readiness and publishes the canonical package artifact. A dry run builds the artifact without sending it to a registry.

```sh
npm exec -- workspace-publish --package . --dry-run
```

Supported options include:

- Public npm (default), GitHub Packages, or both registries
- npm distribution tags and package access controls
- saved tarball artifacts
- optional inclusion of publishable workspace dependencies

## Examples and documentation

- [`examples/`](./examples): copyable examples for every command.
- [`docs/`](./docs): user documentation.
- [`docs/04-development/`](./docs/04-development): development and repository-maintenance documentation.

## Related repositories

- [`moyarich/reusable-workflows`](https://github.com/moyarich/reusable-workflows): reusable GitHub workflows and standalone GitHub Actions that build on these commands for CI.

## License

MIT

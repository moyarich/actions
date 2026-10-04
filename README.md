# Moya Actions

Reusable GitHub Actions, workflows, scripts, and release automation for Node.js, npm packages, VS Code extensions, documentation sites, and other Moya projects.

## Public API

This repository uses directory and naming conventions to make the supported automation surface explicit:

- `.github/workflows/reusable_*.yml` — public reusable workflows
- `actions/*/action.yml` — public reusable actions
- `scripts/*` — reusable scripts and repository tooling
- non-`reusable_*` workflows — automation used by this repository itself

Reusable workflows must live directly in `.github/workflows/`, so the `reusable_` prefix is the public/private boundary for workflows.

Two repository-maintenance workflows are designed for self-healing use:

- `reusable_prettier.yml` — formats with the caller's declared Prettier version and can commit fixes.
- `reusable_npm-package-lock.yml` — recreates and validates `package-lock.json` and can commit fixes.

## Documentation

See [docs](./docs/page.mdx) for getting started, the workflow catalog, and repository conventions. Copyable caller workflows live under [`examples/.github/workflows`](./examples/.github/workflows) and mirror their destination path in consuming repositories.

## Versioning

Consumers should pin a release tag or stable major tag when available:

```yaml
jobs:
  ci:
    uses: moyarich/actions/.github/workflows/reusable_node-ci.yml@v0.1.0
```

## License

MIT
